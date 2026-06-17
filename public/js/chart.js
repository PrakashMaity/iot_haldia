/**
 * Renders a clean, minimal line chart in a canvas container
 * Classic B&W style with subtle fill
 * @param {HTMLCanvasElement} canvas 
 * @param {Array<number>} data 
 */
export function drawSparkline(canvas, data) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI screens
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.width;
    const height = rect.height || canvas.height;

    // Resize matching internal resolution with display scale
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
    }
    
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Draw subtle grid
    ctx.strokeStyle = "rgba(51, 255, 51, 0.12)";
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    const gridCols = 12;
    for (let i = 1; i < gridCols; i++) {
        const x = (i / gridCols) * width;
        ctx.beginPath();
        ctx.setLineDash([1, 3]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    // Horizontal grid lines
    const gridRows = 4;
    for (let i = 1; i < gridRows; i++) {
        const y = (i / gridRows) * height;
        ctx.beginPath();
        ctx.setLineDash([1, 3]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    ctx.setLineDash([]); // Reset line dash

    if (!data || data.length === 0) {
        ctx.fillStyle = "rgba(51, 255, 51, 0.4)";
        ctx.font = "500 10px 'IBM Plex Mono', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Awaiting Readings", width / 2, height / 2);
        return;
    }

    const padding = 10;
    const maxVal = 100;
    const minVal = 0;
    const points = data.map((v, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((v - minVal) / (maxVal - minVal)) * (height - 2 * padding);
        return { x, y, val: v };
    });

    // 1. Draw area fill under the curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, height);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const xc = (points[i - 1].x + points[i].x) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, (points[i - 1].y + points[i].y) / 2);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(points[points.length - 1].x, height);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
    areaGrad.addColorStop(0, "rgba(51, 255, 51, 0.2)");
    areaGrad.addColorStop(1, "rgba(51, 255, 51, 0.01)");
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 2. Draw the main path line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const xc = (points[i - 1].x + points[i].x) / 2;
        ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, (points[i - 1].y + points[i].y) / 2);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = "#33FF33";
    ctx.shadowBlur = 6;
    ctx.shadowColor = "#33FF33";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset glow

    // 3. Draw dot on latest point
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#33FF33";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#33FF33";
    ctx.fill();
    ctx.shadowBlur = 0; // Reset glow

    // 4. Draw subtle outer ring on dot
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 5.5, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(51, 255, 51, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
}
