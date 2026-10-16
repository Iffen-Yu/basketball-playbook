// All court geometry shares one uniform metre-to-SVG scale. Baseline is y=0.
// FIBA Official Basketball Rules 2024, Article 2 and diagrams 1 and 3:
// https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-v10a.pdf
// Nominal dimensions are drawn on stroke centrelines (maximum 2.5 cm edge offset).
(() => {
  const dimensions = Object.freeze({
    width: 15,
    halfLength: 14,
    lineWidth: 0.05,
    rimFromBaseline: 1.575,
    rimRadius: 0.225,
    backboardFromBaseline: 1.2,
    backboardWidth: 1.8,
    laneWidth: 4.9,
    freeThrowFromBaseline: 5.8,
    freeThrowRadius: 1.8,
    threePointRadius: 6.75,
    cornerFromSideline: 0.9,
    noChargeRadius: 1.3,
    centreRadius: 1.8
  });
  const scale = 60;
  const padding = 30;
  const point = (x, y) => ({ x: padding + x * scale, y: padding + y * scale });
  window.COURT = Object.freeze({ dimensions, scale, padding, point });

  const court = document.querySelector("#court");
  const layer = document.querySelector("#court-lines");
  const add = (tag, attrs) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    layer.appendChild(node);
    return node;
  };
  const d = dimensions;
  const centreX = d.width / 2;
  const laneLeft = centreX - d.laneWidth / 2;
  const laneRight = centreX + d.laneWidth / 2;
  const rim = point(centreX, d.rimFromBaseline);
  const freeThrow = point(centreX, d.freeThrowFromBaseline);
  const freeRadius = d.freeThrowRadius * scale;
  const threeRadius = d.threePointRadius * scale;
  const cornerOffset = centreX - d.cornerFromSideline;
  const joinY = d.rimFromBaseline + Math.sqrt(d.threePointRadius ** 2 - cornerOffset ** 2);
  const leftJoin = point(d.cornerFromSideline, joinY);
  const rightJoin = point(d.width - d.cornerFromSideline, joinY);
  const noChargeRadius = d.noChargeRadius * scale;
  const centre = point(centreX, d.halfLength);
  const centreRadius = d.centreRadius * scale;

  court.setAttribute("viewBox", `0 0 ${d.width * scale + padding * 2} ${d.halfLength * scale + padding * 2}`);
  layer.setAttribute("stroke-width", d.lineWidth * scale);
  add("rect", {
    id: "court-boundary", x: padding, y: padding,
    width: d.width * scale, height: d.halfLength * scale, fill: "url(#wood)"
  });
  add("rect", {
    id: "restricted-area", x: point(laneLeft, 0).x, y: padding,
    width: d.laneWidth * scale, height: d.freeThrowFromBaseline * scale,
    fill: "#b77d48", "fill-opacity": 0.2
  });
  // Free-throw line connects the lane sides; only its central 3.6 m is the FT line.
  add("path", {
    id: "free-throw-line", d: `M${point(laneLeft, d.freeThrowFromBaseline).x} ${freeThrow.y} H${point(laneRight, 0).x}`
  });
  add("path", {
    id: "free-throw-outer-arc",
    d: `M${freeThrow.x - freeRadius} ${freeThrow.y} A${freeRadius} ${freeRadius} 0 0 0 ${freeThrow.x + freeRadius} ${freeThrow.y}`
  });
  add("path", {
    id: "free-throw-inner-arc", "stroke-dasharray": "9 9",
    d: `M${freeThrow.x - freeRadius} ${freeThrow.y} A${freeRadius} ${freeRadius} 0 0 1 ${freeThrow.x + freeRadius} ${freeThrow.y}`
  });
  add("path", {
    id: "three-point-line", class: "three-point-line",
    d: `M${leftJoin.x} ${padding} V${leftJoin.y} A${threeRadius} ${threeRadius} 0 0 0 ${rightJoin.x} ${rightJoin.y} V${padding}`
  });
  add("path", {
    id: "no-charge-arc",
    d: `M${rim.x - noChargeRadius} ${point(0, d.backboardFromBaseline).y} V${rim.y} A${noChargeRadius} ${noChargeRadius} 0 0 0 ${rim.x + noChargeRadius} ${rim.y} V${point(0, d.backboardFromBaseline).y}`
  });
  add("path", {
    id: "centre-circle",
    d: `M${centre.x - centreRadius} ${centre.y} A${centreRadius} ${centreRadius} 0 0 1 ${centre.x + centreRadius} ${centre.y}`
  });
  add("path", {
    id: "backboard", "stroke-width": 5,
    d: `M${point(centreX - d.backboardWidth / 2, d.backboardFromBaseline).x} ${point(0, d.backboardFromBaseline).y} H${point(centreX + d.backboardWidth / 2, 0).x}`
  });
  add("circle", { id: "basket-rim", cx: rim.x, cy: rim.y, r: d.rimRadius * scale, stroke: "#ef6e22", "stroke-width": 4 });
})();
