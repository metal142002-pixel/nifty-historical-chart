const chartContainer =
    document.getElementById("chart");

const drawingLayer =
    document.getElementById("drawingLayer");

const chart =
    LightweightCharts.createChart(
        chartContainer,
        {
            width: chartContainer.clientWidth,
            height: chartContainer.clientHeight,

            layout: {
                background: { color: "#ffffff" },
                textColor: "#333333"
            },

            grid: {
                vertLines: {
                    color: "#eeeeee"
                },

                horzLines: {
                    color: "#eeeeee"
                }
            },

            crosshair: {
                mode:
                    LightweightCharts.CrosshairMode.Normal
            },

            rightPriceScale: {
                visible: true,
                borderColor: "#cccccc"
            },

            timeScale: {
                visible: true,
                borderColor: "#cccccc",

                timeVisible: true,
                secondsVisible: false,

                rightOffset: 10,

                barSpacing: 8,
                minBarSpacing: 0.5
            },

            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: true
            },

            handleScale: {
                axisPressedMouseMove: true,
                mouseWheel: true,
                pinch: true
            }
        }
    );


const candleSeries =
    chart.addSeries(
        LightweightCharts.CandlestickSeries,
        {
            upColor: "#26a69a",
            downColor: "#ef5350",

            borderUpColor: "#26a69a",
            borderDownColor: "#ef5350",

            wickUpColor: "#26a69a",
            wickDownColor: "#ef5350"
        }
    );


// =====================================================
// STATE
// =====================================================

let drawings = [];

let selectedDrawing = null;

let currentTool = null;

let firstPoint = null;

let previewElement = null;

let drawingsVisible = true;

let dragState = null;

let loadedData = [];


// Measurement-specific state
let measurementDragging = false;

let measurementStartPoint = null;

let measurementCurrentPoint = null;


// =====================================================
// SVG HELPER
// =====================================================

function svg(type) {

    return document.createElementNS(
        "http://www.w3.org/2000/svg",
        type
    );
}


// =====================================================
// MOUSE → CHART POINT
// =====================================================

function mouseToPoint(event) {

    const bounds =
        drawingLayer.getBoundingClientRect();

    const x =
        event.clientX - bounds.left;

    const y =
        event.clientY - bounds.top;


    const time =
        chart.timeScale()
            .coordinateToTime(x);


    const price =
        candleSeries.coordinateToPrice(y);


    if (
        time === null ||
        time === undefined ||
        price === null ||
        price === undefined
    ) {

        return null;
    }


    let numericTime;


    if (
        typeof time === "object"
    ) {

        // BusinessDay object
        numericTime =
            Date.UTC(
                time.year,
                time.month - 1,
                time.day
            ) / 1000;

    }

    else {

        numericTime =
            Number(time);
    }


    return {

        time:
            numericTime,

        price:
            Number(price)
    };
}


// =====================================================
// POINT → PIXEL
// =====================================================

function pointToPixel(point) {

    const x =
        chart.timeScale()
            .timeToCoordinate(
                point.time
            );


    const y =
        candleSeries.priceToCoordinate(
            point.price
        );


    if (
        x === null ||
        x === undefined ||
        y === null ||
        y === undefined
    ) {

        return null;
    }


    return {

        x:
            Number(x),

        y:
            Number(y)
    };
}


// =====================================================
// CLEAR PREVIEW
// =====================================================

function clearPreview() {

    if (previewElement) {

        previewElement.remove();

        previewElement = null;
    }
}


// =====================================================
// REDRAW
// =====================================================

function redrawDrawings() {

    if (!drawingsVisible) {

        drawingLayer.innerHTML = "";

        return;
    }


    drawingLayer.innerHTML = "";


    drawings.forEach(
        function(drawing) {

            if (
                drawing.type ===
                "trendline"
            ) {

                renderTrendline(
                    drawing
                );
            }


            if (
                drawing.type ===
                "rectangle"
            ) {

                renderRectangle(
                    drawing
                );
            }


            if (
                drawing.type ===
                "measurement"
            ) {

                renderMeasurement(
                    drawing
                );
            }
        }
    );
}


// =====================================================
// TRENDLINE
// =====================================================

function renderTrendline(drawing) {

    const p1 =
        pointToPixel(
            drawing.p1
        );

    const p2 =
        pointToPixel(
            drawing.p2
        );


    if (!p1 || !p2) {

        return;
    }


    const group =
        svg("g");


    const hitLine =
        svg("line");


    hitLine.setAttribute(
        "x1",
        p1.x
    );

    hitLine.setAttribute(
        "y1",
        p1.y
    );

    hitLine.setAttribute(
        "x2",
        p2.x
    );

    hitLine.setAttribute(
        "y2",
        p2.y
    );

    hitLine.setAttribute(
        "stroke",
        "transparent"
    );

    hitLine.setAttribute(
        "stroke-width",
        "14"
    );

    hitLine.setAttribute(
        "fill",
        "none"
    );

    hitLine.style.pointerEvents =
        "stroke";


    const line =
        svg("line");


    line.setAttribute(
        "x1",
        p1.x
    );

    line.setAttribute(
        "y1",
        p1.y
    );

    line.setAttribute(
        "x2",
        p2.x
    );

    line.setAttribute(
        "y2",
        p2.y
    );


    line.classList.add(
        "trendline"
    );


    if (
        drawing ===
        selectedDrawing
    ) {

        line.classList.add(
            "drawing-selected"
        );
    }


    hitLine.addEventListener(
        "pointerdown",
        function(event) {

            if (currentTool) {

                return;
            }


            event.preventDefault();
            event.stopPropagation();


            selectDrawing(
                drawing
            );


            startMoveDrawing(
                drawing,
                event
            );
        }
    );


    group.appendChild(
        hitLine
    );


    group.appendChild(
        line
    );


    if (
        drawing ===
        selectedDrawing
    ) {

        createHandle(
            group,
            drawing,
            "p1",
            p1
        );


        createHandle(
            group,
            drawing,
            "p2",
            p2
        );
    }


    drawingLayer.appendChild(
        group
    );
}


// =====================================================
// HANDLE
// =====================================================

function createHandle(
    group,
    drawing,
    pointName,
    pixel
) {

    const handle =
        svg("circle");


    handle.setAttribute(
        "cx",
        pixel.x
    );

    handle.setAttribute(
        "cy",
        pixel.y
    );

    handle.setAttribute(
        "r",
        "7"
    );


    handle.classList.add(
        "drawing-handle"
    );


    handle.style.pointerEvents =
        "all";


    handle.addEventListener(
        "pointerdown",
        function(event) {

            event.preventDefault();
            event.stopPropagation();


            selectDrawing(
                drawing
            );


            startHandleDrag(
                drawing,
                pointName,
                event
            );
        }
    );


    group.appendChild(
        handle
    );
}


// =====================================================
// RECTANGLE
// =====================================================

function renderRectangle(drawing) {

    const p1 =
        pointToPixel(
            drawing.p1
        );


    const p2 =
        pointToPixel(
            drawing.p2
        );


    if (!p1 || !p2) {

        return;
    }


    const group =
        svg("g");


    const x =
        Math.min(
            p1.x,
            p2.x
        );


    const y =
        Math.min(
            p1.y,
            p2.y
        );


    const width =
        Math.abs(
            p2.x -
            p1.x
        );


    const height =
        Math.abs(
            p2.y -
            p1.y
        );


    const rect =
        svg("rect");


    rect.setAttribute(
        "x",
        x
    );

    rect.setAttribute(
        "y",
        y
    );

    rect.setAttribute(
        "width",
        width
    );

    rect.setAttribute(
        "height",
        height
    );


    rect.classList.add(
        "rectangle"
    );


    if (
        drawing ===
        selectedDrawing
    ) {

        rect.classList.add(
            "drawing-selected"
        );
    }


    rect.addEventListener(
        "pointerdown",
        function(event) {

            if (currentTool) {

                return;
            }


            event.preventDefault();
            event.stopPropagation();


            selectDrawing(
                drawing
            );


            startMoveDrawing(
                drawing,
                event
            );
        }
    );


    group.appendChild(
        rect
    );


    if (
        drawing ===
        selectedDrawing
    ) {

        createHandle(
            group,
            drawing,
            "p1",
            p1
        );


        createHandle(
            group,
            drawing,
            "p2",
            p2
        );
    }


    drawingLayer.appendChild(
        group
    );
}


// =====================================================
// FIND NEAREST BAR
// =====================================================

function findNearestBarIndex(time) {

    if (
        !loadedData ||
        loadedData.length === 0
    ) {

        return -1;
    }


    let low = 0;

    let high =
        loadedData.length - 1;


    while (
        low <= high
    ) {

        const mid =
            Math.floor(
                (low + high) / 2
            );


        const midTime =
            Number(
                loadedData[mid].time
            );


        if (
            midTime ===
            time
        ) {

            return mid;
        }


        if (
            midTime <
            time
        ) {

            low =
                mid + 1;
        }

        else {

            high =
                mid - 1;
        }
    }


    if (
        low <= 0
    ) {

        return 0;
    }


    if (
        low >=
        loadedData.length
    ) {

        return (
            loadedData.length - 1
        );
    }


    const before =
        loadedData[
            low - 1
        ];


    const after =
        loadedData[
            low
        ];


    const beforeDistance =
        Math.abs(
            Number(before.time) -
            time
        );


    const afterDistance =
        Math.abs(
            Number(after.time) -
            time
        );


    if (
        beforeDistance <
        afterDistance
    ) {

        return low - 1;
    }


    return low;
}


// =====================================================
// CREATE MEASUREMENT
// =====================================================

function createMeasurement(
    p1,
    p2
) {

    if (
        !p1 ||
        !p2
    ) {

        return null;
    }


    if (
        !Number.isFinite(
            p1.price
        ) ||
        !Number.isFinite(
            p2.price
        )
    ) {

        return null;
    }


    if (
        p1.price === 0
    ) {

        return null;
    }


    const priceChange =
        p2.price -
        p1.price;


    const percentChange =
        (
            priceChange /
            p1.price
        ) *
        100;


    const elapsedSeconds =
        Math.abs(
            p2.time -
            p1.time
        );


    const index1 =
        findNearestBarIndex(
            p1.time
        );


    const index2 =
        findNearestBarIndex(
            p2.time
        );


    let bars = 0;


    if (
        index1 !== -1 &&
        index2 !== -1
    ) {

        bars =
            Math.abs(
                index2 -
                index1
            );
    }


    return {

        type:
            "measurement",

        p1: {

            time:
                p1.time,

            price:
                p1.price
        },

        p2: {

            time:
                p2.time,

            price:
                p2.price
        },

        priceChange:
            priceChange,

        percentChange:
            percentChange,

        bars:
            bars,

        elapsedSeconds:
            elapsedSeconds
    };
}


// =====================================================
// FORMAT NUMBER
// =====================================================

function formatSignedNumber(
    value,
    decimals
) {

    const sign =
        value >= 0
            ? "+"
            : "";


    return (
        sign +
        Number(value).toFixed(
            decimals
        )
    );
}


// =====================================================
// FORMAT TIME
// =====================================================

function formatElapsedTime(
    totalSeconds
) {

    totalSeconds =
        Math.round(
            totalSeconds
        );


    const days =
        Math.floor(
            totalSeconds /
            86400
        );


    const hours =
        Math.floor(
            (
                totalSeconds %
                86400
            ) /
            3600
        );


    const minutes =
        Math.floor(
            (
                totalSeconds %
                3600
            ) /
            60
        );


    const seconds =
        totalSeconds %
        60;


    let result = "";


    if (
        days > 0
    ) {

        result +=
            days +
            "d ";
    }


    if (
        hours > 0 ||
        days > 0
    ) {

        result +=
            hours +
            "h ";
    }


    if (
        minutes > 0 ||
        hours > 0 ||
        days > 0
    ) {

        result +=
            minutes +
            "m";
    }


    if (
        days === 0 &&
        hours === 0 &&
        minutes === 0
    ) {

        result +=
            seconds +
            "s";
    }


    return result.trim();
}


// =====================================================
// MEASUREMENT LABEL
// =====================================================

function createMeasurementLabel(
    measurement,
    x,
    y
) {

    const group =
        svg("g");


    const text =
        svg("text");


    text.textContent =
        formatSignedNumber(
            measurement.percentChange,
            2
        ) +
        "%   " +
        formatSignedNumber(
            measurement.priceChange,
            2
        ) +
        "   " +
        measurement.bars +
        " bars   " +
        formatElapsedTime(
            measurement.elapsedSeconds
        );


    text.setAttribute(
        "x",
        x
    );


    text.setAttribute(
        "y",
        y
    );


    text.setAttribute(
        "text-anchor",
        "middle"
    );


    text.setAttribute(
        "font-family",
        "Arial, sans-serif"
    );


    text.setAttribute(
        "font-size",
        "13"
    );


    text.setAttribute(
        "font-weight",
        "600"
    );


    text.setAttribute(
        "fill",
        "#2962ff"
    );


    const textWidth =
        Math.max(
            100,
            text.textContent.length *
            7.2
        );


    const background =
        svg("rect");


    background.setAttribute(
        "x",
        x -
        textWidth / 2 -
        6
    );


    background.setAttribute(
        "y",
        y -
        15
    );


    background.setAttribute(
        "width",
        textWidth +
        12
    );


    background.setAttribute(
        "height",
        "20"
    );


    background.setAttribute(
        "rx",
        "4"
    );


    background.setAttribute(
        "fill",
        "#ffffff"
    );


    background.setAttribute(
        "fill-opacity",
        "0.92"
    );


    background.setAttribute(
        "stroke",
        "#2962ff"
    );


    background.setAttribute(
        "stroke-width",
        "1"
    );


    group.appendChild(
        background
    );


    group.appendChild(
        text
    );


    return group;
}


// =====================================================
// RENDER MEASUREMENT
// =====================================================

function renderMeasurement(
    drawing
) {

    const p1 =
        pointToPixel(
            drawing.p1
        );


    const p2 =
        pointToPixel(
            drawing.p2
        );


    if (!p1 || !p2) {

        return;
    }


    const group =
        svg("g");


    // Main diagonal line

    const line =
        svg("line");


    line.setAttribute(
        "x1",
        p1.x
    );


    line.setAttribute(
        "y1",
        p1.y
    );


    line.setAttribute(
        "x2",
        p2.x
    );


    line.setAttribute(
        "y2",
        p2.y
    );


    line.setAttribute(
        "stroke",
        "#2962ff"
    );


    line.setAttribute(
        "stroke-width",
        drawing === selectedDrawing
            ? "3"
            : "2"
    );


    line.setAttribute(
        "stroke-dasharray",
        "5 4"
    );


    // Vertical guide

    const vertical =
        svg("line");


    vertical.setAttribute(
        "x1",
        p2.x
    );


    vertical.setAttribute(
        "y1",
        p1.y
    );


    vertical.setAttribute(
        "x2",
        p2.x
    );


    vertical.setAttribute(
        "y2",
        p2.y
    );


    vertical.setAttribute(
        "stroke",
        "#2962ff"
    );


    vertical.setAttribute(
        "stroke-width",
        "1"
    );


    vertical.setAttribute(
        "stroke-dasharray",
        "4 4"
    );


    // Horizontal guide

    const horizontal =
        svg("line");


    horizontal.setAttribute(
        "x1",
        p1.x
    );


    horizontal.setAttribute(
        "y1",
        p2.y
    );


    horizontal.setAttribute(
        "x2",
        p2.x
    );


    horizontal.setAttribute(
        "y2",
        p2.y
    );


    horizontal.setAttribute(
        "stroke",
        "#2962ff"
    );


    horizontal.setAttribute(
        "stroke-width",
        "1"
    );


    horizontal.setAttribute(
        "stroke-dasharray",
        "4 4"
    );


    // Start circle

    const startCircle =
        svg("circle");


    startCircle.setAttribute(
        "cx",
        p1.x
    );


    startCircle.setAttribute(
        "cy",
        p1.y
    );


    startCircle.setAttribute(
        "r",
        "5"
    );


    startCircle.setAttribute(
        "fill",
        "#ffffff"
    );


    startCircle.setAttribute(
        "stroke",
        "#2962ff"
    );


    startCircle.setAttribute(
        "stroke-width",
        "2"
    );


    // End circle

    const endCircle =
        svg("circle");


    endCircle.setAttribute(
        "cx",
        p2.x
    );


    endCircle.setAttribute(
        "cy",
        p2.y
    );


    endCircle.setAttribute(
        "r",
        "5"
    );


    endCircle.setAttribute(
        "fill",
        "#ffffff"
    );


    endCircle.setAttribute(
        "stroke",
        "#2962ff"
    );


    endCircle.setAttribute(
        "stroke-width",
        "2"
    );


    // Invisible hit area

    const hitLine =
        svg("line");


    hitLine.setAttribute(
        "x1",
        p1.x
    );


    hitLine.setAttribute(
        "y1",
        p1.y
    );


    hitLine.setAttribute(
        "x2",
        p2.x
    );


    hitLine.setAttribute(
        "y2",
        p2.y
    );


    hitLine.setAttribute(
        "stroke",
        "transparent"
    );


    hitLine.setAttribute(
        "stroke-width",
        "16"
    );


    hitLine.style.pointerEvents =
        "stroke";


    hitLine.addEventListener(
        "pointerdown",
        function(event) {

            if (currentTool) {

                return;
            }


            event.preventDefault();
            event.stopPropagation();


            selectDrawing(
                drawing
            );
        }
    );


    // Label position

    const labelX =
        (
            p1.x +
            p2.x
        ) / 2;


    let labelY =
        Math.min(
            p1.y,
            p2.y
        ) - 12;


    if (
        labelY < 18
    ) {

        labelY =
            Math.max(
                p1.y,
                p2.y
            ) + 22;
    }


    const label =
        createMeasurementLabel(
            drawing,
            labelX,
            labelY
        );


    group.appendChild(
        vertical
    );


    group.appendChild(
        horizontal
    );


    group.appendChild(
        line
    );


    group.appendChild(
        label
    );


    group.appendChild(
        startCircle
    );


    group.appendChild(
        endCircle
    );


    group.appendChild(
        hitLine
    );


    drawingLayer.appendChild(
        group
    );
}


// =====================================================
// MEASUREMENT PREVIEW
// =====================================================

function renderMeasurementPreview(
    p1,
    p2
) {

    clearPreview();


    const measurement =
        createMeasurement(
            p1,
            p2
        );


    if (!measurement) {

        return;
    }


    const pixel1 =
        pointToPixel(
            p1
        );


    const pixel2 =
        pointToPixel(
            p2
        );


    if (
        !pixel1 ||
        !pixel2
    ) {

        return;
    }


    const group =
        svg("g");


    // Main line

    const line =
        svg("line");


    line.setAttribute(
        "x1",
        pixel1.x
    );


    line.setAttribute(
        "y1",
        pixel1.y
    );


    line.setAttribute(
        "x2",
        pixel2.x
    );


    line.setAttribute(
        "y2",
        pixel2.y
    );


    line.setAttribute(
        "stroke",
        "#2962ff"
    );


    line.setAttribute(
        "stroke-width",
        "2"
    );


    line.setAttribute(
        "stroke-dasharray",
        "5 4"
    );


    // Vertical

    const vertical =
        svg("line");


    vertical.setAttribute(
        "x1",
        pixel2.x
    );


    vertical.setAttribute(
        "y1",
        pixel1.y
    );


    vertical.setAttribute(
        "x2",
        pixel2.x
    );


    vertical.setAttribute(
        "y2",
        pixel2.y
    );


    vertical.setAttribute(
        "stroke",
        "#2962ff"
    );


    vertical.setAttribute(
        "stroke-width",
        "1"
    );


    vertical.setAttribute(
        "stroke-dasharray",
        "4 4"
    );


    // Horizontal

    const horizontal =
        svg("line");


    horizontal.setAttribute(
        "x1",
        pixel1.x
    );


    horizontal.setAttribute(
        "y1",
        pixel2.y
    );


    horizontal.setAttribute(
        "x2",
        pixel2.x
    );


    horizontal.setAttribute(
        "y2",
        pixel2.y
    );


    horizontal.setAttribute(
        "stroke",
        "#2962ff"
    );


    horizontal.setAttribute(
        "stroke-width",
        "1"
    );


    horizontal.setAttribute(
        "stroke-dasharray",
        "4 4"
    );


    // Start point

    const startCircle =
        svg("circle");


    startCircle.setAttribute(
        "cx",
        pixel1.x
    );


    startCircle.setAttribute(
        "cy",
        pixel1.y
    );


    startCircle.setAttribute(
        "r",
        "5"
    );


    startCircle.setAttribute(
        "fill",
        "#ffffff"
    );


    startCircle.setAttribute(
        "stroke",
        "#2962ff"
    );


    startCircle.setAttribute(
        "stroke-width",
        "2"
    );


    // End point

    const endCircle =
        svg("circle");


    endCircle.setAttribute(
        "cx",
        pixel2.x
    );


    endCircle.setAttribute(
        "cy",
        pixel2.y
    );


    endCircle.setAttribute(
        "r",
        "5"
    );


    endCircle.setAttribute(
        "fill",
        "#ffffff"
    );


    endCircle.setAttribute(
        "stroke",
        "#2962ff"
    );


    endCircle.setAttribute(
        "stroke-width",
        "2"
    );


    // Label

    const labelX =
        (
            pixel1.x +
            pixel2.x
        ) / 2;


    let labelY =
        Math.min(
            pixel1.y,
            pixel2.y
        ) - 12;


    if (
        labelY < 18
    ) {

        labelY =
            Math.max(
                pixel1.y,
                pixel2.y
            ) + 22;
    }


    const label =
        createMeasurementLabel(
            measurement,
            labelX,
            labelY
        );


    group.appendChild(
        vertical
    );


    group.appendChild(
        horizontal
    );


    group.appendChild(
        line
    );


    group.appendChild(
        label
    );


    group.appendChild(
        startCircle
    );


    group.appendChild(
        endCircle
    );


    drawingLayer.appendChild(
        group
    );


    previewElement =
        group;
}


// =====================================================
// SELECT
// =====================================================

function selectDrawing(
    drawing
) {

    selectedDrawing =
        drawing;


    redrawDrawings();
}


// =====================================================
// HANDLE DRAG
// =====================================================

function startHandleDrag(
    drawing,
    pointName,
    event
) {

    const startPoint =
        mouseToPoint(
            event
        );


    if (!startPoint) {

        return;
    }


    dragState = {

        type:
            "handle",

        drawing:
            drawing,

        pointName:
            pointName
    };
}


// =====================================================
// MOVE DRAWING
// =====================================================

function startMoveDrawing(
    drawing,
    event
) {

    const startPoint =
        mouseToPoint(
            event
        );


    if (!startPoint) {

        return;
    }


    dragState = {

        type:
            "move",

        drawing:
            drawing,

        startMouse:
            startPoint,

        originalP1: {

            time:
                drawing.p1.time,

            price:
                drawing.p1.price
        },

        originalP2: {

            time:
                drawing.p2.time,

            price:
                drawing.p2.price
        }
    };
}


// =====================================================
// EXISTING DRAWING DRAG
// =====================================================

document.addEventListener(
    "pointermove",
    function(event) {

        if (!dragState) {

            return;
        }


        const point =
            mouseToPoint(
                event
            );


        if (!point) {

            return;
        }


        if (
            dragState.type ===
            "handle"
        ) {

            dragState.drawing[
                dragState.pointName
            ] = {

                time:
                    point.time,

                price:
                    point.price
            };


            if (
                dragState.drawing.type ===
                "measurement"
            ) {

                updateMeasurement(
                    dragState.drawing
                );
            }


            redrawDrawings();


            return;
        }


        if (
            dragState.type ===
            "move"
        ) {

            const timeDifference =
                point.time -
                dragState.startMouse.time;


            const priceDifference =
                point.price -
                dragState.startMouse.price;


            dragState.drawing.p1 = {

                time:
                    dragState.originalP1.time +
                    timeDifference,

                price:
                    dragState.originalP1.price +
                    priceDifference
            };


            dragState.drawing.p2 = {

                time:
                    dragState.originalP2.time +
                    timeDifference,

                price:
                    dragState.originalP2.price +
                    priceDifference
            };


            if (
                dragState.drawing.type ===
                "measurement"
            ) {

                updateMeasurement(
                    dragState.drawing
                );
            }


            redrawDrawings();
        }
    }
);


// =====================================================
// GLOBAL POINTER UP
// =====================================================

document.addEventListener(
    "pointerup",
    function(event) {

        // ---------------------------------------------
        // FINISH MEASUREMENT
        // ---------------------------------------------

        if (
            measurementDragging
        ) {

            const finalPoint =
                mouseToPoint(
                    event
                );


            if (
                measurementStartPoint &&
                finalPoint
            ) {

                const measurement =
                    createMeasurement(
                        measurementStartPoint,
                        finalPoint
                    );


                if (measurement) {

                    drawings.push(
                        measurement
                    );


                    selectedDrawing =
                        measurement;
                }
            }


            measurementDragging =
                false;


            measurementStartPoint =
                null;


            measurementCurrentPoint =
                null;


            clearPreview();


            deactivateTool();


            redrawDrawings();
        }


        dragState =
            null;
    }
);


// =====================================================
// UPDATE MEASUREMENT
// =====================================================

function updateMeasurement(
    drawing
) {

    const updated =
        createMeasurement(
            drawing.p1,
            drawing.p2
        );


    if (!updated) {

        return;
    }


    drawing.priceChange =
        updated.priceChange;


    drawing.percentChange =
        updated.percentChange;


    drawing.bars =
        updated.bars;


    drawing.elapsedSeconds =
        updated.elapsedSeconds;
}


// =====================================================
// DRAWING LAYER POINTER DOWN
// =====================================================

drawingLayer.addEventListener(
    "pointerdown",
    function(event) {

        if (!currentTool) {

            return;
        }


        const point =
            mouseToPoint(
                event
            );


        if (!point) {

            return;
        }


        // =============================================
        // MEASUREMENT
        // =============================================

        if (
            currentTool ===
            "measurement"
        ) {

            event.preventDefault();
            event.stopPropagation();


            measurementStartPoint =
                point;


            measurementCurrentPoint =
                point;


            measurementDragging =
                true;


            // Capture pointer so dragging
            // continues outside SVG.

            try {

                drawingLayer.setPointerCapture(
                    event.pointerId
                );

            }

            catch (error) {

                console.log(
                    "Pointer capture unavailable"
                );
            }


            return;
        }


        // =============================================
        // TRENDLINE / RECTANGLE
        // =============================================

        if (!firstPoint) {

            firstPoint =
                point;

            return;
        }


        const secondPoint =
            point;


        if (
            currentTool ===
            "trendline"
        ) {

            const drawing = {

                type:
                    "trendline",

                p1:
                    firstPoint,

                p2:
                    secondPoint
            };


            drawings.push(
                drawing
            );


            selectedDrawing =
                drawing;
        }


        if (
            currentTool ===
            "rectangle"
        ) {

            const drawing = {

                type:
                    "rectangle",

                p1:
                    firstPoint,

                p2:
                    secondPoint
            };


            drawings.push(
                drawing
            );


            selectedDrawing =
                drawing;
        }


        firstPoint =
            null;


        clearPreview();


        redrawDrawings();


        deactivateTool();
    }
);


// =====================================================
// DRAWING LAYER POINTER MOVE
// =====================================================

drawingLayer.addEventListener(
    "pointermove",
    function(event) {

        // =============================================
        // MEASUREMENT DRAG
        // =============================================

        if (
            measurementDragging &&
            measurementStartPoint
        ) {

            const point =
                mouseToPoint(
                    event
                );


            if (!point) {

                return;
            }


            measurementCurrentPoint =
                point;


            renderMeasurementPreview(
                measurementStartPoint,
                measurementCurrentPoint
            );


            return;
        }


        // =============================================
        // NORMAL DRAWING PREVIEW
        // =============================================

        if (!currentTool) {

            return;
        }


        if (
            currentTool ===
            "measurement"
        ) {

            return;
        }


        if (!firstPoint) {

            return;
        }


        const point =
            mouseToPoint(
                event
            );


        if (!point) {

            return;
        }


        clearPreview();


        const p1 =
            pointToPixel(
                firstPoint
            );


        const p2 =
            pointToPixel(
                point
            );


        if (!p1 || !p2) {

            return;
        }


        if (
            currentTool ===
            "trendline"
        ) {

            previewElement =
                svg("line");


            previewElement.setAttribute(
                "x1",
                p1.x
            );


            previewElement.setAttribute(
                "y1",
                p1.y
            );


            previewElement.setAttribute(
                "x2",
                p2.x
            );


            previewElement.setAttribute(
                "y2",
                p2.y
            );


            previewElement.classList.add(
                "drawing-preview"
            );
        }


        if (
            currentTool ===
            "rectangle"
        ) {

            previewElement =
                svg("rect");


            previewElement.setAttribute(
                "x",
                Math.min(
                    p1.x,
                    p2.x
                )
            );


            previewElement.setAttribute(
                "y",
                Math.min(
                    p1.y,
                    p2.y
                )
            );


            previewElement.setAttribute(
                "width",
                Math.abs(
                    p2.x -
                    p1.x
                )
            );


            previewElement.setAttribute(
                "height",
                Math.abs(
                    p2.y -
                    p1.y
                )
            );


            previewElement.classList.add(
                "drawing-preview"
            );
        }


        drawingLayer.appendChild(
            previewElement
        );
    }
);


// =====================================================
// RIGHT CLICK
// =====================================================

chartContainer.addEventListener(
    "contextmenu",
    function(event) {

        event.preventDefault();


        deactivateTool();


        firstPoint =
            null;


        measurementStartPoint =
            null;


        measurementCurrentPoint =
            null;


        measurementDragging =
            false;


        clearPreview();


        selectedDrawing =
            null;


        dragState =
            null;


        redrawDrawings();
    }
);


// =====================================================
// ACTIVATE TOOL
// =====================================================

function activateTool(
    tool
) {

    currentTool =
        tool;


    firstPoint =
        null;


    measurementStartPoint =
        null;


    measurementCurrentPoint =
        null;


    measurementDragging =
        false;


    clearPreview();


    const toolIds = [

        "trendlineTool",

        "rectangleTool",

        "percentageTool"

    ];


    toolIds.forEach(
        function(id) {

            document
                .getElementById(id)
                .classList.remove(
                    "active"
                );
        }
    );


    if (
        tool ===
        "trendline"
    ) {

        document
            .getElementById(
                "trendlineTool"
            )
            .classList.add(
                "active"
            );
    }


    if (
        tool ===
        "rectangle"
    ) {

        document
            .getElementById(
                "rectangleTool"
            )
            .classList.add(
                "active"
            );
    }


    if (
        tool ===
        "measurement"
    ) {

        document
            .getElementById(
                "percentageTool"
            )
            .classList.add(
                "active"
            );
    }


    chartContainer.classList.add(
        "drawing-mode"
    );


    drawingLayer.style.pointerEvents =
        "all";
}


// =====================================================
// DEACTIVATE TOOL
// =====================================================

function deactivateTool() {

    currentTool =
        null;


    firstPoint =
        null;


    clearPreview();


    chartContainer.classList.remove(
        "drawing-mode"
    );


    drawingLayer.style.pointerEvents =
        "none";


    const toolIds = [

        "trendlineTool",

        "rectangleTool",

        "percentageTool"

    ];


    toolIds.forEach(
        function(id) {

            document
                .getElementById(id)
                .classList.remove(
                    "active"
                );
        }
    );
}


// =====================================================
// % BUTTON
// =====================================================

document
    .getElementById(
        "percentageTool"
    )
    .addEventListener(
        "click",
        function() {

            if (
                currentTool ===
                "measurement"
            ) {

                deactivateTool();
            }

            else {

                activateTool(
                    "measurement"
                );
            }
        }
    );


// =====================================================
// TRENDLINE BUTTON
// =====================================================

document
    .getElementById(
        "trendlineTool"
    )
    .addEventListener(
        "click",
        function() {

            if (
                currentTool ===
                "trendline"
            ) {

                deactivateTool();
            }

            else {

                activateTool(
                    "trendline"
                );
            }
        }
    );


// =====================================================
// RECTANGLE BUTTON
// =====================================================

document
    .getElementById(
        "rectangleTool"
    )
    .addEventListener(
        "click",
        function() {

            if (
                currentTool ===
                "rectangle"
            ) {

                deactivateTool();
            }

            else {

                activateTool(
                    "rectangle"
                );
            }
        }
    );


// =====================================================
// DELETE SELECTED
// =====================================================

function deleteSelectedDrawing() {

    if (!selectedDrawing) {

        return;
    }


    const index =
        drawings.indexOf(
            selectedDrawing
        );


    if (
        index !== -1
    ) {

        drawings.splice(
            index,
            1
        );
    }


    selectedDrawing =
        null;


    dragState =
        null;


    redrawDrawings();
}


// =====================================================
// DELETE ALL
// =====================================================

function deleteAllDrawings() {

    drawings = [];


    selectedDrawing =
        null;


    dragState =
        null;


    redrawDrawings();
}


// =====================================================
// DELETE BUTTON
// =====================================================

document
    .getElementById(
        "deleteSelected"
    )
    .addEventListener(
        "click",
        function() {

            deleteSelectedDrawing();
        }
    );


document
    .getElementById(
        "deleteAll"
    )
    .addEventListener(
        "click",
        function() {

            deleteAllDrawings();
        }
    );


// =====================================================
// HIDE / SHOW
// =====================================================

document
    .getElementById(
        "toggleDrawings"
    )
    .addEventListener(
        "click",
        function() {

            drawingsVisible =
                !drawingsVisible;


            this.textContent =
                drawingsVisible
                    ? "◉"
                    : "○";


            redrawDrawings();
        }
    );


// =====================================================
// KEYBOARD
// =====================================================

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key ===
            "Escape"
        ) {

            deactivateTool();


            measurementDragging =
                false;


            measurementStartPoint =
                null;


            measurementCurrentPoint =
                null;


            dragState =
                null;
        }


        if (
            event.key ===
            "Delete"
        ) {

            deleteSelectedDrawing();
        }
    }
);


// =====================================================
// CHART MOVEMENT
// =====================================================

chart
    .timeScale()
    .subscribeVisibleLogicalRangeChange(
        function() {

            redrawDrawings();
        }
    );


// =====================================================
// LOAD DATA
// =====================================================

async function loadData(
    timeframe
) {

    try {

        const response =
            await fetch(
                `/api/data?timeframe=${timeframe}`
            );


        if (!response.ok) {

            throw new Error(
                "Server returned " +
                response.status
            );
        }


        const data =
            await response.json();


        // VERY IMPORTANT:
        // Save current candles for bar counting.

        loadedData =
            data;


        candleSeries.setData(
            data
        );


        chart
            .timeScale()
            .fitContent();


        redrawDrawings();


        console.log(
            "Loaded:",
            timeframe,
            data.length,
            "candles"
        );
    }


    catch (error) {

        console.error(
            error
        );


        alert(
            "Could not load chart data."
        );
    }
}


// =====================================================
// TIMEFRAME
// =====================================================

document
    .getElementById(
        "timeframe"
    )
    .addEventListener(
        "change",
        function() {

            loadData(
                this.value
            );
        }
    );


// =====================================================
// RESET
// =====================================================

document
    .getElementById(
        "resetZoom"
    )
    .addEventListener(
        "click",
        function() {

            chart
                .timeScale()
                .fitContent();


            redrawDrawings();
        }
    );


// =====================================================
// RESIZE
// =====================================================

window.addEventListener(
    "resize",
    function() {

        chart.resize(
            chartContainer.clientWidth,
            chartContainer.clientHeight
        );


        drawingLayer.setAttribute(
            "width",
            chartContainer.clientWidth
        );


        drawingLayer.setAttribute(
            "height",
            chartContainer.clientHeight
        );


        redrawDrawings();
    }
);


// =====================================================
// SVG SIZE
// =====================================================

drawingLayer.setAttribute(
    "width",
    chartContainer.clientWidth
);


drawingLayer.setAttribute(
    "height",
    chartContainer.clientHeight
);


drawingLayer.style.pointerEvents =
    "none";


// =====================================================
// START
// =====================================================

loadData("5m");