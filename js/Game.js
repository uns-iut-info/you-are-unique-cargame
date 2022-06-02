window.onload = init;
function init() {
    // called when the DOM is ready
    var game = new Game();
}

class Game {
    constructor() {
        this.canvas = document.querySelector("#myCanvas");

        this.engine = new BABYLON.Engine(this.canvas, true);

        this.divFps = document.getElementById("fps");//fps

        this.divScore = document.getElementById("score");

        this.scene;

        window.addEventListener("resize", () => this.engine.resize());

        this.inputStates = {};

        this.score = 0;

        this.nbOfObstaclesToSpawn = 30;

        this.level = 1;

        this.obstaclesHealth = 1;

        chronoStart();

        this.run();
    }

    loadSounds(scene) {
        var assetsManager = scene.assetsManager;
        var binaryTask = assetsManager.addBinaryFileTask("obstacleCarDestroyedSound", "/assets/nri-cannon.mp3");
        binaryTask.onSuccess = function (task) {
            scene.assets.obstacleCarDestroyedSound = new BABYLON.Sound("obstacleCarDestroyed", task.data, scene, null, { loop: false });
        }

        binaryTask = assetsManager.addBinaryFileTask("cannonballSound", "/assets/sound3.mp3");
        binaryTask.onSuccess = function (task) {
            scene.assets.cannonballSound = new BABYLON.Sound("cannonBall", task.data, scene, null, { loop: false, volume: 0.4 });
        }

        binaryTask = assetsManager.addBinaryFileTask("plopSound", "https://mainline.i3s.unice.fr/mooc/SkywardBound/assets/sounds/plop.mp3");
        binaryTask.onSuccess = function (task) {
            scene.assets.plop = new BABYLON.Sound("plop", task.data, scene, null, { loop: false, volume: 0.4 });
        }

        binaryTask = assetsManager.addBinaryFileTask("backgroundMusic", "/assets/backgroundMusic.mp3");
        binaryTask.onSuccess = function (task) {
            scene.assets.backgroundMusic = new BABYLON.Sound("musica", task.data, scene, null, {
                loop: true,
                autoplay: true,
                volume: 0.2
            });
        }
    }

    createScene() {
        this.scene = new BABYLON.Scene(this.engine);
        this.scene.assetsManager = this.configureAssetManager(this.scene, this.engine);
        this.scene.enablePhysics();

        this.ground = this.createGround(this.scene);

        this.car = this.createcar(this.scene);

        this.camera = this.createFreeCamera(this.scene);// second parameter is the target to follow
        this.scene.activeCamera = this.camera;

        this.createLights(this.scene);

        this.createPetrol(this.scene);
        this.essence = [];

        // background
        new BABYLON.Layer("background", "assets/background.jpg", this.scene, true);

        this.walls = [];
        this.createWalls();

        this.obstacles = [];
        this.createObstacles("models/cop/", "Cop.babylon", this.nbOfObstaclesToSpawn / 2);
        this.createObstacles("models/obstacles/", "SUV.babylon", this.nbOfObstaclesToSpawn / 2);

        this.createTarget();

        this.loadSounds(this.scene);

        return this.scene;
    }

    createObstacles(path, fileName, nbObstaclesToSpawn) {
        let obstaclesTask = this.scene.assetsManager.addMeshTask("obstacles task", "", path, fileName);
        obstaclesTask.onSuccess = function (task) {
            onObstaclesImported(task.loadedMeshes, task.loadedParticleSystems, task.loadedSkeletons);
        }

        let _this = this;
        function onObstaclesImported(newMeshes, particleSystems, skeletons) {
            //BABYLON.SceneLoader.ImportMesh("", path, fileName, this.scene, (newMeshes, particleSystems, skeletons) => {
            var obstacleCar = newMeshes[0];
            obstacleCar.scaling = new BABYLON.Vector3(2, 2, 2);
            obstacleCar.position = new BABYLON.Vector3(400, 2, 49);
            //obstacleCar.rotation.y = Math.PI;
            obstacleCar.initialPosition = obstacleCar.position;
            obstacleCar.health = _this.obstaclesHealth;
            obstacleCar.particleSystem = _this.createParticleSystem();
            _this.setParticleSystemDefaultValues(obstacleCar);


            _this.obstacles.push(obstacleCar);

            for (let i = 0; i < nbObstaclesToSpawn; i++) {
                _this.obstacles.push(_this.doClone(obstacleCar, skeletons, i));
            }

            // Collision obstacles/walls
            _this.obstacles.forEach(obstacle => {
                obstacle.actionManager = new BABYLON.ActionManager(_this.scene);
                _this.walls.forEach(wall => {
                    obstacle.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        {
                            trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
                            parameter: wall
                        },
                        () => {
                            obstacle.position = new BABYLON.Vector3(_this.getRandomIntInclusive(20, 831), 2, _this.getRandomIntInclusive(0, 840));
                        }
                    ));
                });
            });
        };
    }

    moveObstacles() {
        this.obstacles.forEach(obstacle => {
            var randomInt = this.getRandomIntInclusive(1, 2);
            obstacle.speed = randomInt;
            obstacle.frontVector = new BABYLON.Vector3(0, 0, 1);
            obstacle.moveWithCollisions(obstacle.frontVector.multiplyByFloats(-obstacle.speed, -obstacle.speed, -obstacle.speed));
        });
    }

    createTarget() {
        let targetTask = this.scene.assetsManager.addMeshTask("target task", "", "models/target/", "OpenBarn.babylon");
        targetTask.onSuccess = function (task) {
            onTargetImported(task.loadedMeshes, task.loadedParticleSystems, task.loadedSkeletons);
        }

        function onTargetImported(newMeshes, particleSystems, skeletons) {
            //BABYLON.SceneLoader.ImportMesh("", "models/target/", "OpenBarn.babylon", this.scene, (newMeshes, particleSystems, skeletons) => {
            let gasStation = newMeshes[0];
            gasStation.position = new BABYLON.Vector3(800, 2, 820);
            gasStation.scaling = new BABYLON.Vector3(6, 6, 6);
            gasStation.name = "gasStation";
        }
    }

    createWalls() {
        var options = {
            height: 80,
            width: 1300
        }
        var wallsMaterial = new BABYLON.StandardMaterial("wallsMaterial");
        wallsMaterial.diffuseTexture = new BABYLON.Texture("assets/wall.jpg");
        wallsMaterial.emissiveColor = new BABYLON.Color3.White();
        wallsMaterial.diffuseTexture.uScale = 4;

        var wall = new BABYLON.MeshBuilder.CreateBox("box", options);//back wall
        wall.position = new BABYLON.Vector3(200, 41, 35)
        this.walls.push(wall);
        wall.material = wallsMaterial;

        wall = new BABYLON.MeshBuilder.CreateBox("box", options);//front wall
        wall.position = new BABYLON.Vector3(200, 41, 840);
        this.walls.push(wall);
        wall.material = wallsMaterial;

        wall = new BABYLON.MeshBuilder.CreateBox("box", options);//left wall
        wall.position = new BABYLON.Vector3(-24, 41, 200);
        wall.rotation.y = Math.PI / 2;
        this.walls.push(wall);
        wall.material = wallsMaterial;

        wall = new BABYLON.MeshBuilder.CreateBox("box", options);//right wall
        wall.position = new BABYLON.Vector3(831, 41, 200);
        wall.rotation.y = Math.PI / 2;
        this.walls.push(wall);
        wall.material = wallsMaterial;

    }

    createFreeCamera(scene) {
        let camera = new BABYLON.FreeCamera("freeCamera", new BABYLON.Vector3(0, 50, 0), scene);
        camera.attachControl(this.canvas);
        // prevent camera to cross ground
        camera.checkCollisions = true;
        // avoid flying with the camera
        camera.applyGravity = true;

        // Add extra keys for camera movements
        // Need the ascii code of the extra key(s). We use a string method here to get the ascii code
        camera.keysUp.push('z'.charCodeAt(0));
        camera.keysDown.push('s'.charCodeAt(0));
        camera.keysLeft.push('q'.charCodeAt(0));
        camera.keysRight.push('d'.charCodeAt(0));
        camera.keysUp.push('Z'.charCodeAt(0));
        camera.keysDown.push('S'.charCodeAt(0));
        camera.keysLeft.push('Q'.charCodeAt(0));
        camera.keysRight.push('D'.charCodeAt(0));

        return camera;
    }

    createFollowCamera(scene, target) {
        let camera = new BABYLON.FollowCamera("carFollowCamera", target.position, scene, target);
        //camera.attachControl(this.canvas, true);

        camera.radius = -150; // how far from the object to follow
        camera.heightOffset = 100; // how high above the object to place the camera
        // camera.rotationOffset = -180; // the viewing angle
        // camera.cameraAcceleration = .1; // how fast to move
        // camera.maxCameraSpeed = 5; // speed limit
        // camera.fov = 1.7;

        return camera;
    }

    createGround(scene) {
        let mapTask = scene.assetsManager.addMeshTask("map task", "", "models/map/", "myMap.babylon");
        mapTask.onSuccess = function (task) {
            onMapImported(task.loadedMeshes, task.loadedParticleSystems, task.loadedSkeletons);
        }

        function onMapImported(newMeshes, particleSystems, skeletons) {
            //BABYLON.SceneLoader.ImportMesh("", "models/map/", "myMap.babylon", scene, (newMeshes, particleSystems, skeletons) => {
            let map = newMeshes[0];
            map.scaling = new BABYLON.Vector3(10, 10, 10);

            map.physicsImpostor = new BABYLON.PhysicsImpostor(map,
                BABYLON.PhysicsImpostor.PlaneImpostor, { mass: 0 }, scene);
        };
    }

    createLights(scene) {
        var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), scene);
    }

    createcar(scene) {
        let carTask = scene.assetsManager.addMeshTask("car task", "Car_Con_Box", "models/car/", "Futuristic_Car_2.1_blend.babylon");
        carTask.onSuccess = function (task) {
            onCarImported(task.loadedMeshes, task.loadedParticleSystems, task.loadedSkeletons);
        }

        let _this = this;
        //console.log("cons : " + this);

        function onCarImported(newMeshes, particleSystems, skeletons) {
            //BABYLON.SceneLoader.ImportMesh("Car_Con_Box", "models/car/", "Futuristic_Car_2.1_blend.babylon", scene, (newMeshes, particleSystems, skeletons) => {
            let car = newMeshes[0];
            car.scaling = new BABYLON.Vector3(1, 1, 1);
            car.position = new BABYLON.Vector3(390, 4, 49);

            var material2 = new BABYLON.StandardMaterial("mat", scene);
            material2.diffuseTexture = new BABYLON.Texture("models/car/textures/Futuristic_Car_N.jpg", scene);
            material2.diffuseColor = new BABYLON.Color3.Green();

            car.material = material2;

            let mesh = newMeshes[1];
            mesh.material = material2;
            mesh = newMeshes[2];
            mesh.material = material2;
            mesh = newMeshes[3];
            mesh.material = material2;
            mesh = newMeshes[4];
            mesh.material = material2;
            mesh = newMeshes[6];
            mesh.material = material2;
            mesh = newMeshes[10];
            mesh.material = material2;
            mesh = newMeshes[14];
            mesh.material = material2;

            car.name = "herocar";
            car.speed = 1;
            car.frontVector = new BABYLON.Vector3(0, 0, 1);

            car.move = () => {
                if (_this.inputStates.up) {
                    //car.moveWithCollisions(new BABYLON.Vector3(0, 0, 1*car.speed));
                    car.moveWithCollisions(car.frontVector.multiplyByFloats(car.speed, car.speed, car.speed));
                }
                if (_this.inputStates.down) {
                    //car.moveWithCollisions(new BABYLON.Vector3(0, 0, -1*car.speed));
                    car.moveWithCollisions(car.frontVector.multiplyByFloats(-car.speed, -car.speed, -car.speed));
                }
                if (_this.inputStates.left) {
                    //car.moveWithCollisions(new BABYLON.Vector3(-1*car.speed, 0, 0));
                    car.rotation.y -= 0.02;
                    car.frontVector = new BABYLON.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
                }
                if (_this.inputStates.right) {
                    //car.moveWithCollisions(new BABYLON.Vector3(1*car.speed, 0, 0));
                    car.rotation.y += 0.02;
                    car.frontVector = new BABYLON.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
                }
                // if (this.inputStates.jump) {
                //     this.scene.activeCamera = this.createFreeCamera(this.scene);
                //     //this.scene.activeCamera.position = car.position;
                //     this.scene.activeCamera.radius = -150; // how far from the object to follow
                //     this.scene.activeCamera.heightOffset = 100; // how high above the object to place the camera
                //     car.position.y += 2;
                //     setTimeout(() => {
                //         this.scene.activeCamera = this.createFollowCamera(this.scene , car);
                //         car.position.y -= 2;
                //     }, 500);
                // }

                //Collision
                car.actionManager = new BABYLON.ActionManager(scene);
                _this.essence.forEach(ess => {
                    car.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        {
                            trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
                            parameter: ess
                        },
                        () => {
                            ess.dispose();
                            _this.score++;
                            _this.showScore(_this.score);
                            //_this.charge.play();
                            _this.scene.assets.plop.play();
                            console.log("boummm");
                        }
                    ));
                });

                _this.walls.forEach(wall => { // gérer içi la collision entre la voiture et les walls 
                    car.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        {
                            trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
                            parameter: wall
                        },
                        () => {
                            car.position = new BABYLON.Vector3(400, 4, 49);
                            console.log("Ossama");
                        }
                    ));
                });

                _this.obstacles.forEach(obstacle => {
                    car.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        {
                            trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
                            parameter: obstacle
                        },
                        () => {
                            car.position = new BABYLON.Vector3(400, 4, 49);
                            _this.showDeathMessage();
                        }
                    ));
                });

                let gasStation = _this.scene.getMeshByName("gasStation");
                car.actionManager.registerAction(new BABYLON.ExecuteCodeAction( //gérer içi le passage au niveau supérieur
                    {
                        trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
                        parameter: gasStation
                    },
                    () => {
                        car.position = new BABYLON.Vector3(390, 4, 49);
                        _this.level++;
                        _this.showLevel(_this.level);
                        _this.upgradeObstaclesHealth();
                        _this.upgradeObstaclesSpeed();
                        _this.score += 20;
                        _this.showScore(_this.score);
                    }
                ));
            }
            // to avoid firing too many cannonball rapidly
            car.canFire = true;
            car.fireAfter = 0.3; // in seconds

            car.fire = () => {
                if (!_this.inputStates.space) return;

                if (!car.canFire) return;

                // ok, we fire, let's put the above property to false
                car.canFire = false;


                // let's be able to fire again after a while
                setTimeout(() => {
                    car.canFire = true;
                }, 1000 * car.fireAfter)

                // Create a canonball
                let cannonball = BABYLON.MeshBuilder.CreateSphere("cannonball", { diameter: 2, segments: 32 }, scene);
                cannonball.material = new BABYLON.StandardMaterial("Fire", scene);
                cannonball.material.diffuseTexture = new BABYLON.Texture("assets/Fire.jpg", scene)

                let pos = car.position;

                // position the cannonball above the tank
                cannonball.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);

                // move cannonBall position from above the center of the tank to above a bit further than the frontVector end (5 meter s further)
                cannonball.position.addInPlace(car.frontVector.multiplyByFloats(5, 5, 5));

                // add physics to the cannonball, mass must be non null to see gravity apply
                cannonball.physicsImpostor = new BABYLON.PhysicsImpostor(cannonball,
                    BABYLON.PhysicsImpostor.SphereImpostor, { mass: 1 }, scene);

                // the cannonball needs to be fired, so we need an impulse !
                // we apply it to the center of the sphere
                let powerOfFire = 100;
                let azimuth = 0.02;//0.1
                let aimForceVector = new BABYLON.Vector3(car.frontVector.x * powerOfFire, (car.frontVector.y + azimuth) * powerOfFire, car.frontVector.z * powerOfFire);

                cannonball.physicsImpostor.applyImpulse(aimForceVector, cannonball.getAbsolutePosition());

                cannonball.actionManager = new BABYLON.ActionManager(_this.scene);
                _this.obstacles.forEach(obstacle => {
                    cannonball.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
                        {
                            trigger: BABYLON.ActionManager.OnIntersectionEnterTrigger,
                            parameter: obstacle
                        },
                        () => {
                            // this.obstacleCarGotDestroyed(obstacle);
                            // obstacle.dispose();
                            //if(obstacle._isDisposed) return ;
                            console.log("Boum ya plus la voiture xd ");
                            _this.score += 5;
                            _this.showScore(_this.score);
                            _this.decreaseHealth(obstacle.position, obstacle);
                        }
                    ));
                });

                //_this.cannonballSound.play();
                _this.scene.assets.cannonballSound.play();

                // Make the cannonball disappear after 3s
                setTimeout(() => {
                    cannonball.dispose();
                }, 3000);
            }

            return car;
        }
    }

    upgradeObstaclesHealth() {
        this.obstaclesHealth++;
        this.obstacles.forEach(obstacle => {
            obstacle.health = this.obstaclesHealth;
        });
    }

    upgradeObstaclesSpeed() {
        this.obstacles.forEach(obstacle => {
            obstacle.speed += 0.5;
        });
    }

    showLevel(level) {
        let levelSpan = document.querySelector("#levelSpan");
        levelSpan.innerHTML = level;
    }

    showDeathMessage() {
        let accident = document.querySelector("#accident");
        accident.innerHTML = "You got hit by a car . You are back to the starting point";
        setTimeout(() => {
            accident.innerHTML = "";
        }, 500);
    }

    decreaseHealth(obstaclePosition, obstacle) {
        // locate particle system at hit point
        obstacle.particleSystem.emitter = new BABYLON.Vector3(obstaclePosition.x, obstaclePosition.y + 5, obstaclePosition.z);
        // start particle system
        obstacle.particleSystem.start();

        //make it stop after 300ms
        setTimeout(() => {
            obstacle.particleSystem.stop();
        }, 300);

        obstacle.health--;

        if (obstacle.health <= 0) {
            this.obstacleCarGotDestroyed(obstacle);
        }
    }

    obstacleCarGotDestroyed(obstacle) {
        BABYLON.ParticleHelper.CreateAsync("explosion", this.scene).then((set) => {
            set.systems.forEach(s => {
                s.emitter = obstacle.position;

                s.disposeOnStop = true;
            });
            set.start();
        });
        //this.obstacleCarDestroyedSound.play();
        this.scene.assets.obstacleCarDestroyedSound.play();
        obstacle.dispose();

        this.score += 5;
        this.showScore(this.score);
    }

    createParticleSystem() {
        // Create a particle system
        var particleSystem = new BABYLON.ParticleSystem("particles", 2000, this.scene);

        //Texture of each particle
        particleSystem.particleTexture = new BABYLON.Texture("assets/flare.png", this.scene);
        return particleSystem;
    }

    setParticleSystemDefaultValues(obstacle) {
        let particleSystem = obstacle.particleSystem;

        // Where the particles come from. Will be changed dynacally to the hit point.
        particleSystem.emitter = new BABYLON.Vector3(0, 0, 0); // the starting object, the emitter

        // Colors of all particles RGBA
        particleSystem.color1 = new BABYLON.Color4(1, 0, 0, 1.0);
        particleSystem.color2 = new BABYLON.Color4(1, 0, 0, 1.0);
        particleSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

        particleSystem.emitRate = 100;

        // Set the gravity of all particles
        particleSystem.gravity = new BABYLON.Vector3(0, -9.81, 0);

        // Direction of each particle after it has been emitted
        particleSystem.direction1 = new BABYLON.Vector3(0, -1, 0);
        particleSystem.direction2 = new BABYLON.Vector3(0, -1, 0);

        particleSystem.minEmitPower = 6;
        particleSystem.maxEmitPower = 10;

        // Size of each particle (random between...
        particleSystem.minSize = 0.4;
        particleSystem.maxSize = 0.8;
    }

    showScore(score) {
        let scoreSpan = document.querySelector("#scoreSpan");
        scoreSpan.innerHTML = score;
    }

    createPetrol(scene) {
        let petrolTask = scene.assetsManager.addMeshTask("petrol task", "Jerrycan", "models/", "jerrycan.babylon");
        petrolTask.onSuccess = function (task) {
            onPetrolImported(task.loadedMeshes, task.loadedParticleSystems, task.loadedSkeletons);
        }

        let _this = this;
        function onPetrolImported(newMeshes, particleSystems, skeletons){
        //BABYLON.SceneLoader.ImportMesh("Jerrycan", "models/", "jerrycan.babylon", scene, (newMeshes, particleSystems, skeletons) => {
            let jerrycan = newMeshes[0];
            jerrycan.position.y = 3;
            jerrycan.position.x = 250;
            jerrycan.position.z = 250;
            jerrycan.scaling = new BABYLON.Vector3(5, 5, 5);
            _this.essence.push(jerrycan);

            for (let i = 0; i < 30; i++) {
                _this.essence.push(_this.doClone(jerrycan, skeletons, i));
            }
        }
    }

    getRandomIntInclusive(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    doClone(originalMesh, skeletons, id) {
        let myClone;
        let xrand = this.getRandomIntInclusive(0, 831);
        let zrand = this.getRandomIntInclusive(0, 840);

        myClone = originalMesh.clone("clone_" + id);
        myClone.position = new BABYLON.Vector3(xrand, 2.5, zrand);

        myClone.initialPosition = myClone.position;

        if (!skeletons) return myClone;

        // The mesh has at least one skeleton
        if (!originalMesh.getChildren()) {
            myClone.skeleton = skeletons[0].clone("clone_" + id + "_skeleton");
            return myClone;
        } else {
            if (skeletons.length === 1) {
                // the skeleton controls/animates all children, like in the Dude model
                let clonedSkeleton = skeletons[0].clone("clone_" + id + "_skeleton");
                myClone.skeleton = clonedSkeleton;
                let nbChildren = myClone.getChildren().length;

                for (let i = 0; i < nbChildren; i++) {
                    myClone.getChildren()[i].skeleton = clonedSkeleton
                }
                return myClone;
            } else if (skeletons.length === originalMesh.getChildren().length) {
                // each child has its own skeleton
                for (let i = 0; i < myClone.getChildren().length; i++) {
                    myClone.getChildren()[i].skeleton() = skeletons[i].clone("clone_" + id + "_skeleton_" + i);
                }
                return myClone;
            }
        }
        return myClone;
    }

    modifySettings() {
        // as soon as we click on the game window, the mouse pointer is "locked"
        // you will have to press ESC to unlock it
        this.scene.onPointerDown = () => {
            if (!this.scene.alreadyLocked) {
                console.log("requesting pointer lock");
                this.canvas.requestPointerLock();
            } else {
                console.log("Pointer already locked");
            }
        }

        document.addEventListener("pointerlockchange", () => {
            let element = document.pointerLockElement || null;
            if (element) {
                // lets create a custom attribute
                this.scene.alreadyLocked = true;
            } else {
                this.scene.alreadyLocked = false;
            }
        });

        // key listeners for the car
        this.inputStates.left = false;
        this.inputStates.right = false;
        this.inputStates.up = false;
        this.inputStates.down = false;
        this.inputStates.space = false;

        //add the listener to the main, window object, and update the states
        window.addEventListener('keydown', (event) => {
            if ((event.key === "ArrowLeft") || (event.key === "q") || (event.key === "Q")) {
                this.inputStates.left = true;
            } else if ((event.key === "ArrowUp") || (event.key === "z") || (event.key === "Z")) {
                this.inputStates.up = true;
            } else if ((event.key === "ArrowRight") || (event.key === "d") || (event.key === "D")) {
                this.inputStates.right = true;
            } else if ((event.key === "ArrowDown") || (event.key === "s") || (event.key === "S")) {
                this.inputStates.down = true;
            } else if (event.key === " ") {
                this.inputStates.space = true;
            }
            else if (event.key === "a") {
                this.inputStates.jump = true;
            }
        }, false);

        //if the key will be released, change the states object 
        window.addEventListener('keyup', (event) => {
            if ((event.key === "ArrowLeft") || (event.key === "q") || (event.key === "Q")) {
                this.inputStates.left = false;
            } else if ((event.key === "ArrowUp") || (event.key === "z") || (event.key === "Z")) {
                this.inputStates.up = false;
            } else if ((event.key === "ArrowRight") || (event.key === "d") || (event.key === "D")) {
                this.inputStates.right = false;
            } else if ((event.key === "ArrowDown") || (event.key === "s") || (event.key === "S")) {
                this.inputStates.down = false;
            } else if (event.key === " ") {
                this.inputStates.space = false;
            }
            else if (event.key === "a") {
                this.inputStates.jump = false;
            }
        }, false);
    }

    configureAssetManager(scene, engine) {
        // useful for storing references to assets as properties. i.e scene.assets.cannonsound, etc.
        scene.assets = {};

        let assetsManager = new BABYLON.AssetsManager(scene);

        assetsManager.onProgress = function (remainingCount, totalCount, lastFinishedTask) {
            engine.loadingUIText = 'We are loading the scene. ' + remainingCount + ' out of ' + totalCount + ' items still need to be loaded.';
        };

        assetsManager.onFinish = function (tasks) {

            engine.runRenderLoop(function () {
                scene.toRender();
            });
        };
        return assetsManager;
    }

    run() {
        this.scene = this.createScene();

        // this.music = new BABYLON.Sound("sound", "https://mainline.i3s.unice.fr/mooc/SkywardBound/assets/sounds/humbug.mp3", 
        // this.scene,null, { loop: true, autoplay: true });
        //this.scene.assets.backgroundMusic.play();

        this.modifySettings();

        this.scene.toRender = () => {
            this.divFps.innerHTML = this.engine.getFps().toFixed() + " fps";
            let deltaTime = this.engine.getDeltaTime(); // remind you something ?

            this.car = this.scene.getMeshByName("herocar");
            if (this.car) {
                this.camera = this.createFollowCamera(this.scene, this.car);
                this.scene.activeCamera = this.camera;
                this.car.move();
                this.car.fire();
                this.moveObstacles();
                // if(!this.inputStates.down){
                //     this.car.moveWithCollisions(this.car.frontVector.multiplyByFloats(this.car.speed, this.car.speed, this.car.speed));
                // }
            }


            this.scene.render();
        };

        this.scene.assetsManager.load();
    }
}

