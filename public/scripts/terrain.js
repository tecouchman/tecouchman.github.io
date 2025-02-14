(function () {

    let canvas = document.getElementById('terrain-canvas');
    let bgCanvas = document.getElementById('terrain-bg-canvas');

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    bgCanvas.width = bgCanvas.clientWidth;
    bgCanvas.height = bgCanvas.clientHeight;

    var ctx = canvas.getContext("2d", {willReadFrequently: true});
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    var bgCtx = bgCanvas.getContext("2d", {willReadFrequently: true});
    bgCtx.lineWidth = 2;
    bgCtx.lineJoin = "round";
    
    var noisefn = noise.simplex3;

    let pointDistance = { x: 13, y: 13 };
    let interactHeight = -110;
    let interactDistance = pointDistance.x * 8;
    let dimensions = { width: 28, height: 28 };
    let halfDimensions = { width: dimensions.width / 2, height: dimensions.height / 2 };
    let padding = { x: (bgCanvas.width) / 2 - (dimensions.width * pointDistance.x / 2)+35, y: 90 };
    let usePespective = false
    let speed = 0.01;
    let defaultDirection = { x: -0.0, y: 0.3}
    let smoothedDirection = { x: defaultDirection.x, y: defaultDirection.y }
    let terrainIntensity = 3.2;

    let terrainColor = "#c25e51";
    let waterColor = "#DDDDDD";
    let underWaterColor = "#533a";
    let frameColor = "#5b5757";
    let bgFrameColor = "#494545";

    window.addEventListener("mousemove", (e) => setMousePosition(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => setMousePositsimion(e.touches[0].pageX, e.touches[0].pageY));

    function setMousePosition(x, y) {
        mousePos = { x: (x - getCanvasOffset().x), y: (y - getCanvasOffset().y) * 2 };
    }

    function getCanvasOffset() {
        let rect = bgCtx.canvas.getBoundingClientRect();
        return {
            x: (bgCtx.canvas.offsetLeft + bgCtx.canvas.clientLeft),
            y: (rect.top)
        }
    }   

    let startTime = Date.now();
    let previousFrameTime = startTime;
    let localPos = { x: 0, y: 0 };
    let offset = { x: startTime, y: 0 };
    let openPath = {}
    openPath[ctx.canvas.id] = false;
    openPath[bgCtx.canvas.id] = false;
    let mousePos = { x: 0, y: 0 };

    function rotate(cx, cy, x, y, angle) {
        var radians = (Math.PI / 180) * angle,
            cos = Math.cos(radians),
            sin = Math.sin(radians),
            nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
            ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
        return { x: nx, y: ny };
    }

    function update(timestamp) {
        let deltaTime = timestamp - previousFrameTime
        previousFrameTime = timestamp;

        let direction = calculateDirection();
        offset.x -= deltaTime * speed * -direction.x;
        offset.y -= deltaTime * speed * -direction.y;

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height)

        let water = false;

        for (let y = 0; y < dimensions.height; y++) {

            closePath(ctx);
            closePath(bgCtx);
            let m = mulberry32(y + startTime)

            for (let x = 0; x < dimensions.width; x++) {

                let offsettedPos = { x: x + offset.x, y: y + offset.y };
                localPos.x = padding.x + pointDistance.x * x + (pointDistance.x);
                
                if (usePespective) {
                    localPos.x -= (dimensions.height - y) * (x - halfDimensions.width) / 60;
                    localPos.y = padding.y + pointDistance.y * (y * (y / 60)); 
                }
                else {
                    localPos.y = padding.y + pointDistance.y * y
                }

                let interactY = calculateInteractionOffset(localPos.x, localPos.y);
                let terrain =  calculateTerrain(offsettedPos.x, offsettedPos.y);
                let waves = terrain <= 0 ? calculateWaves(offsettedPos.x, offsettedPos.y, terrain, timestamp) : 0;
                

                waves += interactY;

                let edgeLeft = x == 0;
                let edgeRight = x == dimensions.width - 1;
                let edgeTop = y == 0;
                let edgeBottom = y == dimensions.height - 1;
                let waterStart = !water && terrain <= 0 && !edgeLeft;
                let waterEnd = water && terrain <= 0 && calculateTerrain(offsettedPos.x + 1, offsettedPos.y) > 0 && !edgeRight;
                water = terrain <= 0;

                let terrainHeight = terrain;
                let height = Math.max(terrain, 0) + waves;

                terrainPos = { x: localPos.x - (terrainHeight / 2), y: localPos.y - (terrainHeight / 2) };

                localPos.y -= height / 2;
                localPos.x -= height / 2;

                let prevX = localPos.x;
                if (waterStart) {
                    for (let i = 0.1; i < 1; i += 0.1) {
                        if (calculateTerrain(x - 1 + offset.x + i, offsettedPos.y) <= 0) {
                            localPos.x -= (1-i) * pointDistance.x;
                            break;
                        }
                    }
                    closePath(ctx, localPos.x, localPos.y);
                    beginPath(ctx, localPos.x, localPos.y, getWaterColor(y));

                    beginPath(bgCtx, localPos.x, localPos.y);

                    localPos.x = prevX;
                    closePath(ctx, localPos.x, localPos.y);
                    closePath(bgCtx, localPos.x, localPos.y);
                }
                else if (waterEnd) {
                    for (let i = 0.1; i < 1; i += 0.1) {
                        if (calculateTerrain(offsettedPos.x + i, offsettedPos.y) > 0) {
                            localPos.x += i * pointDistance.x;
                            break;
                        }
                    }
                    rotated = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,prevX.x,localPos.y,-45)
                    ctx.lineTo(rotated.x, rotated.y);
                    closePath(ctx, localPos.x, localPos.y);

                    bgCtx.lineTo(rotated.x, rotated.y);
                    closePath(bgCtx, localPos.x, localPos.y);
                }
                else if (openPath[bgCtx.canvas.id]) {
                    if (water && !edgeBottom) {
                        rotated = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,terrainPos.x,terrainPos.y,-45)
                        bgCtx.lineTo(rotated.x, rotated.y);
                    }

                    rotated = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,localPos.x,localPos.y,-45)
                    ctx.lineTo(rotated.x, rotated.y);
                }

                if (edgeRight || edgeBottom) {
                    closePath(ctx);
                    closePath(bgCtx);

                    bgCtx.lineCap = "round";
                    
                    if (edgeLeft || edgeTop || (edgeRight && edgeBottom) || (edgeTop && edgeLeft)) {

                        bgCtx.setLineDash([]);

                        if (edgeLeft) {
                            beginPath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y + 80,frameColor);
                            closePath(bgCtx, prevX + height/2 + 430, padding.y + pointDistance.y * y + 80,frameColor);

                            bgCtx.setLineDash([1.5,7]);
                            beginPath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y + 80, bgFrameColor);
                            closePath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y- 270);
                            
                        }
                        if (edgeRight && edgeBottom) {
                            beginPath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y + 80,frameColor);
                            closePath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y - 270,frameColor);
                        }

                        if (edgeTop) {
                            bgCtx.setLineDash([1.5,7]);
                            beginPath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y + 80, bgFrameColor);
                            closePath(bgCtx, prevX + height/2 - 275, padding.y + pointDistance.y * y + 80);
                        }

                        bgCtx.setLineDash([]);

                        beginPath(bgCtx, prevX + height/2 + 80, padding.y + pointDistance.y * y + 80,frameColor);
                        closePath(bgCtx, prevX, localPos.y);
                    }

                    bgCtx.fillStyle = bgCtx.strokeStyle = underWaterColor;

                }

                ctx.strokeStyle = water ? getWaterColor(y) : terrainColor;

                if (!openPath[bgCtx.canvas.id] && y != dimensions.y - 1) {
                    beginPath(ctx, localPos.x, localPos.y);
                    beginPath(bgCtx, localPos.x, localPos.y);
                }
            }
        }

        window.requestAnimationFrame(update);
    }
    update(startTime);

    function lerp (a, b, t) { return a + (b - a) * t };

    function calculateDirection() {

        rotatedMouse = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,mousePos.x,mousePos.y,45)
        if (rotatedMouse.x <= - 100 || rotatedMouse.x > bgCanvas.width + 100
            || rotatedMouse.y <= 0 || rotatedMouse.y > bgCanvas.height)
        {
            smoothedDirection = {
                x: lerp(smoothedDirection.x, defaultDirection.x, 0.01),
                y: lerp(smoothedDirection.y, defaultDirection.y, 0.01)
            };
            return smoothedDirection;
        }

        smoothedDirection = {
            x: lerp(smoothedDirection.x, (rotatedMouse.x - (bgCanvas.width / 2)) / (bgCanvas.width / 2), 0.05),
            y: lerp(smoothedDirection.y, (rotatedMouse.y - (bgCanvas.height / 2)) / (bgCanvas.height / 2), 0.05)
        };

        return smoothedDirection;
    }

    function calculateDistance(x1, y1, x2, y2) {
        var a = x1 - x2;
        var b = y1 - y2;
        return Math.sqrt(a*a + b*b);
    }

    function calculateTerrain(x, y) {
        return Math.abs(noisefn(x / 50, y / 50, 0) * 90 * terrainIntensity) - 170
            - Math.abs(noisefn(x / 10, y / 14, 0) * 50);
        }

    function calculateWaves(x, y, terrainHeight, timestamp) {
        let terrainMultiplier = Math.max(Math.min(terrainHeight), -30) / 30;
        let timeOffset = timestamp / 4000;
        return (noisefn(x / 10 + timeOffset, y / 10 , timeOffset + timeOffset) * 20 * terrainMultiplier
        - Math.abs(noisefn(x / 10 + timeOffset, y / 14 + timeOffset, timeOffset) * 40) * -terrainMultiplier) ;
    }

    function calculateInteractionOffset(x, y) {
        let rotated = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,x,y,-45)

        let mouseDistance = calculateDistance(rotated.x, rotated.y - Math.max(interactHeight, 0), mousePos.x, mousePos.y);
        if (mouseDistance < interactDistance)
        {
            return interactHeight * (1 - mouseDistance / interactDistance) 
        }
        return 0;
    }

    function getWaterColor(y) {
        return waterColor + Math.floor((y + 10) / (dimensions.height + 10) * 200).toString(16);
    }

    function beginPath(ctx, x, y, color) {
        openPath[ctx.canvas.id] = true;
        if (color) {
            ctx.strokeStyle = color;
        }
        ctx.beginPath();

        let rotated = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,x,y,-45)
        ctx.moveTo(rotated.x, rotated.y);
    }

    function closePath(ctx, x, y) {
        if (openPath[ctx.canvas.id]) {
            if (x != null && y != null) {
                let rotated = rotate((padding.x + pointDistance.x * dimensions.width)/2,(padding.y + pointDistance.y * dimensions.height)/2,x,y,-45)
                ctx.lineTo(rotated.x, rotated.y);
            }
            ctx.stroke();
            openPath[ctx.canvas.id] = false;
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

})();