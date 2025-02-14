(function () {

    let canvas = document.getElementById('header-canvas');


    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    var ctx = canvas.getContext("2d", {willReadFrequently: true});
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    
    var noisefn = noise.simplex3;

    let pointDistance = { x: 9, y: 6 };
    let interactHeight = 35;
    let interactiDistance = pointDistance.x * 2;
    let dimensions = { width: 38, height: 42 };
    let halfDimensions = { width: dimensions.width / 2, height: dimensions.height / 2 };
    let padding = { x: (canvas.width) / 2 - (dimensions.width * pointDistance.x / 2), y: 100 };
    let usePespective = true
    let speed = 0.01;
    let defaultDirection = { x: -0.0, y: 0.3}

    let colors = ["#c25e51", "#575757", "#1d6258"] 
    let accentColors =   [ "#335588", "#FFFFFF", "#DDDDDD","#BBBBBB"];

    window.addEventListener("mousemove", (e) => setMousePosition(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => setMousePositsimion(e.touches[0].pageX, e.touches[0].pageY));

    function setMousePosition(x, y) {
        mousePos = { x: x -getCanvasOffset().x, y: y - getCanvasOffset().y };
    }

    function getCanvasOffset() {
        return {
            x: (ctx.canvas.offsetLeft + ctx.canvas.clientLeft),
            y: (ctx.canvas.offsetTop + ctx.canvas.clientTop)
        }
    }   

    let getRandomElement = (arr) => {
        return arr[Math.floor((Math.random() * arr.length))]
    }

    let getRandomAccentColor = getRandomElement.bind(null, accentColors);
    let getRandomColor = getRandomElement.bind(null, colors);

    let startTime = Date.now();
    let previousFrameTime = startTime;
    let localPos = { x: 0, y: 0 };
    let offset = { x: startTime, y: 0 };
    let color = getRandomColor();
    let accentColor = getRandomAccentColor();
    let openPath = false;
    let mousePos = { x: 0, y: 0 };


    function update(timestamp) {
        let deltaTime = timestamp - previousFrameTime
        previousFrameTime = timestamp;

        let direction = calculateDirection();
        offset.x -= deltaTime * speed * -direction.x;
        offset.y -= deltaTime * speed * -direction.y;

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        let water = false;

        for (let y = 0; y < dimensions.height; y++) {

            closePath();
            let m = mulberry32(y + startTime)
            ctx.fillStyle = ctx.strokeStyle = m() > 0.2 ? color : accentColor;

            for (let x = 0; x < dimensions.width; x++) {

                let offsettedPos = { x: x + offset.x, y: y + offset.y };

                let distanceFromCenter = calculateDistance(x, y, halfDimensions.width, halfDimensions.height) / (halfDimensions.width)
                if (distanceFromCenter > 1.0) 
                    continue;

                localPos.x = padding.x + pointDistance.x * x + (pointDistance.x / 3 * (y % 2));
  
                if (usePespective) {
                    localPos.x -= (dimensions.height - y) * (x - halfDimensions.width) / 60;
                    localPos.y = padding.y + pointDistance.y * (y * (y / 60)); 
                }
                else {
                    localPos.y = padding.y + pointDistance.y * y
                }

                let terrain = calculateTerrain(offsettedPos.x, offsettedPos.y);
                let waves = terrain <= 0 ? calculateWaves(offsettedPos.x, offsettedPos.y, terrain, timestamp) : 0;
                let interactY = calculateInteractionOffset(localPos.x, localPos.y);

                let waterStart = !water && terrain <= 0;
                let waterEnd = water && terrain <= 0 && calculateTerrain(offsettedPos.x + 1, offsettedPos.y) > 0;
                water = terrain <= 0;

                let height = Math.max(terrain, 0) + waves + interactY;

                localPos.y -= height;

                let prevX = localPos.x;
                if (waterStart) {
                    for (let i = 0.1; i < 1; i += 0.1) {
                        if (calculateTerrain(x - 1 + offset.x + i, offsettedPos.y) <= 0) {
                            localPos.x -= (1-i) * pointDistance.x;
                            break;
                        }
                    }
                    closePath(localPos.x, localPos.y);
                    beginPath(localPos.x, localPos.y, getWaterColor(y));
                    localPos.x = prevX;
                    closePath(localPos.x, localPos.y);
                }
                else if (waterEnd) {
                    for (let i = 0.1; i < 1; i += 0.1) {
                        if (calculateTerrain(offsettedPos.x + i, offsettedPos.y) > 0) {
                            localPos.x += i * pointDistance.x;
                            break;
                        }
                    }
                    ctx.lineTo(prevX, localPos.y);
                    closePath(localPos.x, localPos.y);
                }
                else if (openPath) {
                    ctx.lineTo(localPos.x, localPos.y);
                }

                ctx.strokeStyle = water ? getWaterColor(y) : color
                
                if (!openPath && y != dimensions.y - 1) {
                    beginPath(localPos.x, localPos.y,);
                }
            }
        }

        window.requestAnimationFrame(update);
    }
    update(startTime);

    function calculateDirection() {
        if (mousePos.x <= - 100 || mousePos.x > canvas.width + 100
            || mousePos.y <= 0 || mousePos.y > canvas.height)
        {
            return defaultDirection;
        }

        return {
            x: (mousePos.x - (canvas.width / 2)) / (canvas.width / 2),
            y: (mousePos.y - (canvas.height / 2)) / (canvas.height / 2)
        };
    }

    function calculateDistance(x1, y1, x2, y2) {
        var a = x1 - x2;
        var b = y1 - y2;
        return Math.sqrt(a*a + b*b);
    }

    function calculateTerrain(x, y) {
        return Math.abs(noisefn(x / 50, y / 50, 0) * 90) - 20
            - Math.abs(noisefn(x / 10, y / 14, 0) * 40);
        }

    function calculateWaves(x, y, terrainHeight, timestamp) {
        let terrainMultiplier = Math.max(Math.min(terrainHeight), -30) / 30;
        return noisefn(x / 6, y / 10 , timestamp / 2000) * 10 * terrainMultiplier;
    }

    function calculateInteractionOffset(x, y) {
        let mouseDistance = calculateDistance(x, y - Math.max(interactHeight, 0), mousePos.x, mousePos.y);
        if (mouseDistance < interactiDistance)
        {
            return interactHeight * (1 - mouseDistance / interactiDistance) 
        }
        return 0;
    }

    function getWaterColor(y) {
        return accentColor + Math.floor((y + 10) / (dimensions.height + 10) * 255).toString(16);
    }

    function beginPath(x, y, color) {
        openPath = true;
        if (color) {
            ctx.strokeStyle = color;
        }
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function closePath(x, y) {
        if (openPath) {
            if (x != null && y != null) {
                ctx.lineTo(x, y);
            }
            ctx.stroke();
            openPath = false;
        }
    }

    function mulberry32(a) {
        return function() {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    function loadImage(url, callback) {
        var img = document.createElement('img');
    
        var newImg = new Image;
        newImg.onload = function() {
            img.src = this.src;
            callback(img);
        }
        newImg.src = url;
    }

    loadImage('images/maps/map-low-res.jpg', img => {
        let imgCanvas = document.createElement('canvas');
        imgCanvas.width = img.width;
        imgCanvas.height = img.height;
        imgCanvas.willReadFrequently = true;
        imgCanvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);

        for (let y = 0; y < imgCanvas.height; y++) {
            for (let x = 0; x < imgCanvas.width; x++) {
                var pixelData = imgCanvas.getContext('2d').getImageData(x, y, 1, 1).data;
                // map[y][x].showColor(color) 
            }
        }
        // update();
    })

})();