var KEYPOINT_RADIUS = 7;
var KEYPOINT_OUTLINE_RADIUS = 10;
var WIDTH, HEIGHT;
var DEFAULT_FILL="#FF0";
var DRAG_FILL = "#DB0";
var EDGE_FILL = "#4aF";

var EDGE_BLUE = "#35F";
var EDGE_GREEN = "#4F1";
var EDGE_RED = "#F00";

var FOCUS_SIZE = 50;

var ctx;
var canvas;
var nodes = [
  {x: 179, y: 108}, // 0 right shoulder
  {x: 162, y: 171}, // 1 right elbow
  {x: 159, y: 226}, // 2 right hand
  {x: 287, y: 108}, // 3 left shoulder
  {x: 335, y: 186}, // 4 left elbow
  {x: 294, y: 134}, // 5 left hand
  
  
  {x: 199, y: 241}, // 6 right hip
  {x: 251, y: 366}, // 7 right knee
  {x: 258, y: 517}, // 8 right foot
  
  {x: 273, y: 250}, // 9 left hip
  {x: 251, y: 357}, // 10 left knee
  {x: 200, y: 389}, // 11 left foot
  
  {x: 239, y: 96}, // 12 neck
  {x: 251, y: 56}, // 13 nose
  
  
];

var connections = [
  [0, 1, EDGE_RED],
  [1, 2, EDGE_RED],
//   [0, 3, EDGE_BLUE],
  [3, 4, EDGE_GREEN],
  [4, 5, EDGE_GREEN],
  [0, 6, EDGE_BLUE],
  [6, 7, EDGE_RED],
  [7, 8, EDGE_RED],
  [3, 9, EDGE_BLUE],
  [6, 9, EDGE_BLUE],
  [9, 10, EDGE_GREEN],
  [10, 11, EDGE_GREEN],
  
  
  [0, 12, EDGE_BLUE],
  [3, 12, EDGE_BLUE],
  [12, 13, EDGE_BLUE],
]

var draggedNode = 1;
var hoverNode = -1;

var dragging = false;
var startX, startY;
var offsetX, offsetY;

var im_scale = 1;

// clear the canvas
var clear = function() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
};

// Draw a full circle
var drawNodeFull = function(node, fill=DEFAULT_FILL) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(node.x, node.y, KEYPOINT_RADIUS, 
          0, Math.PI*2);
  ctx.fill();
};

// Draw an empty circle
var drawNodeOutline = function(node, fill=DEFAULT_FILL) {
  ctx.strokeStyle = fill;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(node.x, node.y, KEYPOINT_OUTLINE_RADIUS, 
          0, Math.PI*2);
  ctx.stroke();
}

var drawConnections = function() {
  ctx.strokeStyle = EDGE_FILL;
  ctx.lineWidth = 2;
  for (var i = 0; i < connections.length; i++) {
    var c = connections[i];
    var n1 = nodes[c[0]];
    var n2 = nodes[c[1]];
    var fill = c[2];
    
    ctx.strokeStyle = fill;
    ctx.beginPath();
    ctx.moveTo(n1.x, n1.y);
    ctx.lineTo(n2.x, n2.y);
    ctx.stroke()
  }
}

// Redraw body keypoints
var drawKeypoints = function() {
  for(var i=0;i<nodes.length;i++){
    var n=nodes[i];

    if (dragging && i == draggedNode) {
      drawNodeOutline(n, fill=DRAG_FILL);
      drawNodeFull(n, fill=DRAG_FILL);
    } else  {
      if (i == hoverNode) {
//         console.log('hover node: ', + i)
        drawNodeOutline(n);
      }
      drawNodeFull(n);
    }
  }
};


var drawImage = function() {
  var newHeight = HEIGHT;
  im_scale = image.height / newHeight;
//   var newWidth = newHeight * (image.width/image.height);
  var newWidth = image.width/im_scale
  ctx.drawImage(image, 0, 0, newWidth, newHeight);
};

var drawFocus = function(n) {
  var focus_x = n.x - FOCUS_SIZE/2;
  var focus_y = n.y - FOCUS_SIZE/2;

  // Make sure we don't go out of frame
  if (focus_x < 0) {
    focus_x = 0;
  } else if (focus_x > HEIGHT) {
    focus_x = HEIGHT;
  }

  if (focus_y < 0) {
    focus_y = 0;
  } else if (focus_y > HEIGHT) {
    focus_y = HEIGHT;
  }

  ctx.drawImage(image, focus_x*im_scale, focus_y*im_scale, FOCUS_SIZE*im_scale, FOCUS_SIZE*im_scale,
                HEIGHT, 0, FOCUS_SIZE*4, FOCUS_SIZE*4);

  // draw crosshairs

  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "black";
  ctx.moveTo(HEIGHT+FOCUS_SIZE*2, FOCUS_SIZE*2-11);
  ctx.lineTo(HEIGHT+FOCUS_SIZE*2, FOCUS_SIZE*2+11);
  ctx.stroke();

  ctx.beginPath();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "black";
  ctx.moveTo(HEIGHT+FOCUS_SIZE*2-11, FOCUS_SIZE*2);
  ctx.lineTo(HEIGHT+FOCUS_SIZE*2+11, FOCUS_SIZE*2);
  ctx.stroke()

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "white";
  ctx.moveTo(HEIGHT+FOCUS_SIZE*2, FOCUS_SIZE*2-10);
  ctx.lineTo(HEIGHT+FOCUS_SIZE*2, FOCUS_SIZE*2+10);
  ctx.stroke();

  ctx.beginPath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "white";
  ctx.moveTo(HEIGHT+FOCUS_SIZE*2-10, FOCUS_SIZE*2);
  ctx.lineTo(HEIGHT+FOCUS_SIZE*2+10, FOCUS_SIZE*2);
  ctx.stroke();
  
  drawTextCoords(n);
    
};

var drawTextCoords = function(node) {
  x = node.x;
  y = node.y;
  ctx.fillStyle = "black";
  ctx.font = '20px sans-serif';
  ctx.fillText('x: '+x, HEIGHT, FOCUS_SIZE*4+20);
  ctx.fillText('y: '+y, HEIGHT, FOCUS_SIZE*4+50);
}

var redraw = function() {
  clear();
  drawImage();
  drawConnections();
  drawKeypoints();
  
  if (dragging) {
    drawFocus(nodes[draggedNode]);
  } else if (hoverNode != -1) {
    drawFocus(nodes[hoverNode]);
  }
};

var getNodeAtLocation = function(x, y) {
  var index = -1;
  for(var i=0;i<nodes.length;i++){
    var r=nodes[i];
    if(x>r.x-KEYPOINT_RADIUS && x<r.x+KEYPOINT_RADIUS && 
       y>r.y-KEYPOINT_RADIUS && y<r.y+KEYPOINT_RADIUS){
      index = i;
      break;
    }
  }
  
  return index;
}

var mouseDown = function(e){

  // tell the browser we're handling this mouse event
  e.preventDefault();
  e.stopPropagation();

  // get the current mouse position
  var rect = canvas.getBoundingClientRect()
  var mx = event.clientX - rect.left
  var my = event.clientY - rect.top
//   var mx=parseInt(e.clientX-offsetX);
//   var my=parseInt(e.clientY-offsetY);

  console.log("x:" + mx + " y:" + my);
  
  // test each nodes to see if mouse is inside
  dragging=false;
  
  var nodeIndex = getNodeAtLocation(mx, my);
  if (nodeIndex != -1) {
    dragging=true;
    draggedNode = nodeIndex;

    redraw();
  }
  
  // save the current mouse position
  startX=mx;
  startY=my;
}

var mouseUp = function(e){
  // tell the browser we're handling this mouse event
  e.preventDefault();
  e.stopPropagation();

  // clear all the dragging flags
  dragging = false;
  draggedNode = -1;
  
  redraw();
}


// handle mouse moves
var mouseMove = function(e){
  // tell the browser we're handling this mouse event
  e.preventDefault();
  e.stopPropagation();

  // get the current mouse position
//   var mx=parseInt(e.clientX-offsetX);
//   var my=parseInt(e.clientY-offsetY);
  var rect = canvas.getBoundingClientRect()
  var mx = event.clientX - rect.left
  var my = event.clientY - rect.top

  // if we're dragging anything...
  if (dragging){
    // calculate the distance the mouse has moved
    // since the last mousemove
    var dx=mx-startX;
    var dy=my-startY;

    nodes[draggedNode].x += dx
    nodes[draggedNode].y += dy

    // redraw the scene with the new rect positions
    redraw();

    // reset the starting mouse position for the next mousemove
    startX=mx;
    startY=my;

  } else {
    hoverNode = getNodeAtLocation(mx, my);
    redraw();
//     console.log("hover Node: " + hoverNode)
  }
}