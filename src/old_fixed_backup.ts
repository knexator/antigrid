import Vector2 from "shaku/lib/utils/vector2";
import { LEVEL_DATA } from "./data2";

/*
function Vector(x, y) {
    this.x = x; this.y = y;
}
Vector.prototype.plus = function (other) {
    return new Vector(this.x + other.x, this.y + other.y);
};
Vector.prototype.sub = function (other) {
    return new Vector(this.x - other.x, this.y - other.y);
};
Vector.prototype.times = function (factor) {
    return new Vector(this.x * factor, this.y * factor);
};
Vector.prototype.lerp = function (other, alpha) {
    return new Vector(this.x * (1 - alpha) + other.x * alpha,
        this.y * (1 - alpha) + other.y * alpha);
}
Vector.prototype.dist = function (other) {
    return Math.sqrt((this.x - other.x) * (this.x - other.x) + (this.y - other.y) * (this.y - other.y));
}

Vector.prototype.rotated = function (angle) {
    return new Vector(Math.cos(angle) * this.x - Math.sin(angle) * this.y, Math.cos(angle) * this.y + Math.sin(angle) * this.x);
}

Vector.prototype.cross = function (other) {
    return this.x * other.y - this.y * other.x;
}
*/

window.onload = function () {
    canvas = document.getElementById("gc")! as HTMLCanvasElement;
    ctx = canvas.getContext("2d")!;
    /*canvas.addEventListener('mousemove', onMousemove);
    function onMousemove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }*/
    canvas.oncontextmenu = function (e) {
        e.preventDefault();
    }

    canvas.onmousedown = function (e) {
        window.focus();
        mouse.button = e.which;
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left,
            mouse.y = e.clientY - rect.top,
            mouse.down = true;
        e.preventDefault();
        e.stopPropagation();
        e.target.style.cursor = 'default';
        if (e.which == 2) {
            teleportPlayer();
        } else if (e.which == 3) {
            updatetile();
        }
    };

    canvas.onmouseup = function (e) {
        mouse.down = false;
        selected = undefined;
        fixTris();
        e.preventDefault();
    };

    canvas.onmousemove = function (e) {
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left,
            mouse.y = e.clientY - rect.top,
            mouse.pos.x = mouse.x;
        mouse.pos.y = mouse.y;
        e.preventDefault();
    };
    //setInterval(game,1000/15);
    /*canvas.width = tilesx * tileSize;
    canvas.height = tilesy * tileSize;*/
    runAnimation(run);
}
"use strict"



var arrowCodes = {
    37: "left", 38: "up", 39: "right", 40: "down", 82: "r",
    65: "left", 87: "up", 68: "right", 83: "down", 32: "space"
};
var arrows = trackKeys(arrowCodes);
var mouse = {
    down: false,
    button: 1,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    pos: new Vector2(0, 0)
};
var tilesx = 8;
var tilesy = 8;
var tileSize = 30;
var horSpeed = 3;
var maxSpeed = 70;
var gravity = 3;
var jumpSpeed = 4.5;
var fallThres = -3;
var fallMult = 4;
var stop = false;
//var COLORS = ["FFFFFF", "FF0000", "0000FF"];
var COLORS = ["green", "red", "blue"];
var vertexDamping = 0.1;
var physics_accuracy = 3;
var mouse_influence = 20;
var spring = 0.7;
var parity = 1;

var canvas: HTMLCanvasElement;
var ctx: CanvasRenderingContext2D;

var underMouse: Vertex;
var selected: Vertex | undefined;

var run = function (time: number) {
    //level.vertices.forEach(function(el) {el.attract(mouse.x, mouse.y, 0.1);});
    if (arrows.r) {
        level.vertices.forEach(function (el) {
            el.connected.length = 0;
        });
        level.tiles.length = 0;
        level.vertices.length = 0;
        //level = null;
        level = new Level(LEVEL_DATA);
        player = new Player(.5, .5, level.tiles[12]);
        player.frame.dir = 3;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var i = physics_accuracy;
    while (i--) {
        level.vertices.forEach(function (el) {
            el.connected.forEach(function (con) {
                var c = level.vertices[con];
                //console.log(c);
                el.attract(c.pos.x, c.pos.y, 0.001);
            })
        });
        //level.vertices.forEach(function(el) {el.solveCons();});
    }
    level.vertices.forEach(function (el) { el.addForces(time); });
    underMouse = selected || level.vertices.reduce(function (cur, min) {
        return cur.pos.distanceTo(mouse.pos) < min.pos.distanceTo(mouse.pos) ? cur : min;
    });
    level.vertices.forEach(function (el) { el.update(time); });
    player.update(time);
    level.physics.forEach(function (el) { el.update(time); });
    level.draw();
    player.draw();
    return !stop;
}

class Level {
    tiles: Tile[]
    vertices: Vertex[]
    physics: Phys[]

    constructor(data: typeof LEVEL_DATA) {
        this.tiles = [];
        this.vertices = [];
        this.physics = [];
        if (!data) {
            // for (var j = 0; j < tilesx; j++) {
            //     for (var i = 0; i < tilesy; i++) {
            //         var isBorder = i == 0 || i == tilesx - 1 || j == 0 || j == tilesy - 1
            //         this.tiles.push(new Tile(isBorder, i * tileSize, j * tileSize));
            //     }
            // }
            // for (var j = 0; j < tilesx; j++) {
            //     for (var i = 0; i < tilesy; i++) {
            //         this.tiles[i + tilesx * j].connected.push(this.tiles[i - 1 + tilesx * j]);
            //         this.tiles[i + tilesx * j].connected.push(this.tiles[i + tilesx * (j + 1)]);
            //         this.tiles[i + tilesx * j].connected.push(this.tiles[i + 1 + tilesx * j]);
            //         this.tiles[i + tilesx * j].connected.push(this.tiles[i + tilesx * (j - 1)]);
            //     }
            // }
            // this.tiles[(tilesx - 1) * tilesy - 3].connected[2] = this.tiles[(tilesx - 2) * tilesy - 2];
            // this.tiles[(tilesx - 2) * tilesy - 2].connected[1] = this.tiles[(tilesx - 1) * tilesy - 3];
        } else {
            var that = this;
            data["vertices"].forEach(function (el, ind) {
                that.vertices[el.index] = new Vertex(el.px, el.py, el.border, el.index, el.connected.slice());
            });

            data["faces"].forEach(function (el, ind) {
                that.tiles[el.index] = new Tile(el.value, that.vertices[el.v0], that.vertices[el.v1],
                    that.vertices[el.v2], that.vertices[el.v3], that, el.index);
            });
            data["faces"].forEach(function (el, ind) {
                that.tiles[el.index].connected.push(that.tiles[el.c0]);
                that.tiles[el.index].connected.push(that.tiles[el.c1]);
                that.tiles[el.index].connected.push(that.tiles[el.c2]);
                that.tiles[el.index].connected.push(that.tiles[el.c3]);
            });
            /*canvas.width = data.reduce(function(max, cur) {
                return Math.max(max, cur.v0x);
            }, 0);*/
        }
    }

    draw() {
        //this.tiles.forEach(function (el) {el.draw();});
        ctx.strokeStyle = "#000000";
        this.tiles.forEach(function (el) { el.draw(); });
        this.vertices.forEach(function (el) { el.draw(); });
        this.physics.forEach(function (el) { el.draw(); });

        ctx.strokeStyle = "#FF00FF";
        var pp = player.frame.toScreen();
        var dt = new Vector2(mouse.x - pp.x, mouse.y - pp.y).rotatedRadians((player.frame.dir + 1) * Math.PI / 2);
        let path = raycast(player.frame.tile, player.frame.dir, player.frame.pos.clone(), dt, 100)
        path.forEach(function (el) {
            ctx.beginPath();
            var a = el.tile.coor_to_screen(el.p1.x, el.p1.y, el.dir);
            var b = el.tile.coor_to_screen(el.p2.x, el.p2.y, el.dir);
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });

    }
}

class Tile {
    vertices: Vertex[]
    index: number
    level: Level
    connected: Tile[]
    value: number

    constructor(value: number, v1: Vertex, v2: Vertex, v3: Vertex, v4: Vertex, level: Level, index: number) {
        // this.v1x = v1.x;
        // this.v1y = v1.y;
        // this.v2x = v2.x;
        // this.v2y = v2.y;
        // this.v3x = v3.x;
        // this.v3y = v3.y;
        // this.v4x = v4.x;
        // this.v4y = v4.y;
        this.level = level;
        this.vertices = [v1, v2, v3, v4];
        this.index = index;
        /*this.v2x = v1x+tileSize;
        this.v2y = v1y;
        this.v3x = v1x+tileSize;
        this.v3y = v1y+tileSize;
        this.v4x = v1x;
        this.v4y = v1y+tileSize;*/
        /*this.vertices = [new Vertex(v1x, v1y), new Vertex(v1x, v1y+tileSize),
                         new Vertex(v1x+tileSize, v1y+tileSize), new Vertex(v1x+tileSize, v1y)]*/
        //this.wall = value != 0;
        this.value = value;
        this.connected = [];
    }


    /*Tile.prototype = {
        get wall() { 
            return this.value != 0;
        }
    };*/

    draw() {
        //this.wall ? ctx.fillStyle="#FF0000" : ctx.fillStyle="#0000FF";
        //ctx.fillRect(this.v1x, this.v1y, tileSize, tileSize);
        ctx.fillStyle = COLORS[this.value] || "FF00FF";
        ctx.beginPath();
        ctx.moveTo(this.vertices[3].pos.x, this.vertices[3].pos.y);
        for (var i = 0; i < 4; i++) {
            ctx.lineTo(this.vertices[i].pos.x, this.vertices[i].pos.y);
        }
        //ctx.fillStyle = this.value == 1 ? "red" : "green";
        ctx.fill();
        //ctx.stroke();
    }
    // Coor(0..1) to Screen
    coor_to_screen(x: number, y: number, dir: number) {
        var ab = Vector2.lerp(this.vertices[(4 + dir) % 4].pos, this.vertices[(5 + dir) % 4].pos, y);
        var cd = Vector2.lerp(this.vertices[(7 + dir) % 4].pos, this.vertices[(6 + dir) % 4].pos, y);
        return Vector2.lerp(ab, cd, x);
        //return new Vector(this.v1x + x*tileSize, this.v1y + y*tileSize);
        /*PVector p1 = PVector.lerp(vertices.get((0+dir)%4), vertices.get((1+dir)%4), y);
        PVector p2 = PVector.lerp(vertices.get((3+dir)%4), vertices.get((2+dir)%4), y);
        return PVector.lerp(p1, p2, x);*/
    }

    contains(verts: any[]) {
        var that = this;
        var allfound = true;
        verts.forEach(function (el: Vertex) {
            if (that.vertices.indexOf(el) == -1) {
                allfound = false;
            }
        });
        return allfound;
    }

    containsPoint(point: Vector2) {
        var val = 0;
        var that = this;
        for (var i = 0; i < 4; i++) {
            var EV = that.vertices[i].pos.sub(that.vertices[(i + 1) % 4].pos);
            var PV = point.sub(that.vertices[i].pos);
            var cross = EV.x * PV.y - EV.y * PV.x;
            val += cross / Math.abs(cross);
        }
        return Math.abs(val) == 4;
    }

    invBilinear(p: Vector2, dir: number) {
        // throw new Error("invBilinear no implementado");

        var p0 = this.vertices[(4 + dir) % 4].pos;
        var p1 = this.vertices[(7 + dir) % 4].pos;
        var p3 = this.vertices[(6 + dir) % 4].pos;
        var p2 = this.vertices[(5 + dir) % 4].pos;
        /*var p1 = this.vertices[(5+dir)%4].pos;
        var p3 = this.vertices[(6+dir)%4].pos;
        var p2 = this.vertices[(7+dir)%4].pos;*/

        var A = Vector2.cross(p0.sub(p), p0.sub(p2));
        var B = (Vector2.cross(p0.sub(p), p1.sub(p3)) + Vector2.cross(p1.sub(p), p0.sub(p2))) / 2;
        var C = Vector2.cross(p1.sub(p), p1.sub(p3));
        var s;
        if ((A - 2 * B + C) == 0) {
            s = A / (A - C);
        } else {
            var s1 = ((A - B) + Math.sqrt(B * B - A * C)) / (A - 2 * B + C);
            var s2 = ((A - B) - Math.sqrt(B * B - A * C)) / (A - 2 * B + C);
            s = (0 <= s1 && s1 <= 1) ? s1 : s2;
        }
        var t = ((1 - s) * (p0.x - p.x) + s * (p1.x - p.x)) / ((1 - s) * (p0.x - p2.x) + s * (p1.x - p3.x));
        return new Vector2(s, t);
    }

    get wall(): boolean {
        return this.value != 0;;
    }

}

/*
Tile.prototype.invBilinear = function(p) {
    var a = this.vertices[0].pos;
    var b = this.vertices[3].pos;
    var c = this.vertices[2].pos;
    var d = this.vertices[1].pos;
    var e = b.sub(a);
    var f = d.sub(a);
    var g = a.sub(b.plus(c.sub(d)));
    var h = p.sub(a);
 
    var k2 = g.cross(f);
    var k1 = e.cross(f) + h.cross(g);
    var k0 = h.cross(e);
 
    var w = k1*k1 - 4.0*k0*k2;
    if (w<0.0)
        return null;
    
    w = Math.sqrt(w);
    var v1 = (-k1 - w)/(2.0*k2);
    var u1 = (h.x - f.x*v1)/(e.x + g.x*v1);
 
    var v2 = (-k1 + w)/(2.0*k2);
    var u2 = (h.x - f.x*v2)/(e.x + g.x*v2);
    var u = u1;
    var v = v1;
    if( v<0.0 || v>1.0 || u<0.0 || u>1.0 ) { u=u2;   v=v2; }
    if( v<0.0 || v>1.0 || u<0.0 || u>1.0 ) { u=-1;   v=-1; }
    return new Vector(u, v);
}
*/

class Vertex {
    // x: number
    // y: number
    // px: number
    // py: number
    // vx: number
    // vy: number

    ori: Vector2
    pos: Vector2
    prev_pos: Vector2
    vel: Vector2
    fixed: boolean
    index: number
    connected: number[]
    constructor(x: number, y: number, fixed: boolean, ind: number, connected?: number[]) {
        this.ori = new Vector2(x, y);
        // this.x = x;
        // this.y = y;
        // this.px = x;
        // this.py = y;
        // this.vx = this.vy = 0;
        this.vel = new Vector2(0, 0);
        this.pos = new Vector2(x, y);
        this.prev_pos = this.pos.clone();
        this.fixed = fixed || false;
        this.connected = connected || [];
        this.index = ind;
    }

    draw() {
        ctx.fillStyle = (this == underMouse || this == player.clos) ? "white" : "black"
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        var that = this;
        this.connected.forEach(function (el, ind) {
            ctx.moveTo(that.pos.x, that.pos.y);
            var ver = level.vertices[el];
            ctx.lineTo(ver.pos.x, ver.pos.y);
        });
        ctx.stroke();
    }

    update(step: number) {
        /*var nx = this.x + ((this.x - this.px) * .99) + ((this.vx / 2) * step);
        var ny = this.y + ((this.y - this.py) * .99) + ((this.vy / 2) * step);
        this.px = this.x;
        this.py = this.y;
        this.x = nx;
        this.y = ny;
        this.vy = this.vx = 0;*/
        var that = this;
        if (this == underMouse && mouse.down && mouse.button == 1) {
            this.pos.x = mouse.x;
            this.pos.y = mouse.y;
            selected = this;
            var closest = level.vertices.filter(function (val, ind) {
                return ind != that.index;
            }).reduce(function (cur, min) {
                return cur.pos.distanceTo(that.pos) < min.pos.distanceTo(that.pos) ? cur : min;
            });
            //console.log(closest.pos.dist(this.pos));
            if (closest.pos.distanceTo(this.pos) < 5) {
                //this.connected.indexOf(closest.index) != -1)
                let common = level.tiles.filter(function (el) {
                    return el.contains([that, closest]);
                }).length;
                if (common > 0) {
                    that.merge(closest);
                    //closest.merge(that);
                    selected = closest;
                    fix();
                }
            }
            return;
        } else if (player.clos && this == player.clos) {

        }
    };
    attract(x: number, y: number, f: number) {
        var dx = x - this.pos.x;
        var dy = y - this.pos.y;
        var distance = 1; //Math.sqrt(dx * dx + dy * dy);
        this.pos.x += f * dx / distance;
        this.pos.y += f * dy / distance;
    };


    repel(x: number, y: number, f: number) {
        var dx = x - this.pos.x;
        var dy = y - this.pos.y;
        var distance = Math.sqrt(dx * dx + dy * dy);
        this.pos.x -= f * dx / distance;
        this.pos.y -= f * dy / distance;
    };

    attract2(x: number, y: number, f: number) {
        var dx = x - this.pos.x;
        var dy = y - this.pos.y;
        var distance = 1;//Math.sqrt(dx * dx + dy * dy);
        this.pos.x += f * dx / distance;
        this.pos.y += f * dy / distance;
    };

    addForces(step: number) {
        if (this.fixed) {
            this.pos.copy(this.ori);
            return;
        }
        var diff_x = this.pos.x - mouse.x;
        var diff_y = this.pos.y - mouse.y;
        var dist = Math.sqrt(diff_x * diff_x + diff_y * diff_y);
        /*if (dist < mouse_influence) {
            this.px = this.x - (mouse.x - mouse.px) * 1.8;
            this.py = this.y - (mouse.y - mouse.py) * 1.8;
        }
        this.vy += gravity;*/
    }

    solveCons() {
        var p1 = this;
        var f = spring;
        this.connected.forEach(function (el, ind) {
            var td = 1; //Math.random() * 0.2 + 0.9;
            var p2 = level.vertices[el];
            var diff_x = p1.pos.x - p2.pos.x,
                diff_y = p1.pos.y - p2.pos.y,
                dist = Math.sqrt(diff_x * diff_x + diff_y * diff_y),
                or_dist = p1.ori.distanceTo(p2.ori) * td,
                diff = (or_dist - dist) / dist;

            var px = diff_x * diff * 0.5;
            var py = diff_y * diff * 0.5;
            p1.pos.x += px * f;
            p1.pos.y += py * f;
            p2.pos.x -= px * f;
            p2.pos.y -= py * f;
        });
    }

    merge(other: Vertex) {
        var that = this;
        //other.connected.push.apply(other.connected, that.connected);
        this.connected.forEach(function (el) {
            var ind = other.connected.indexOf(el);
            if (ind == -1 && el != other.index) {
                other.connected.push(el)
                //console.log(el);
            }
        });
        this.connected.forEach(function (el) {
            var vert = level.vertices[el];
            var ind1 = vert.connected.indexOf(other.index);
            var ind2 = vert.connected.indexOf(that.index);
            if (ind1 != -1) {
                vert.connected = vert.connected.filter(function (con: any, i: any) {
                    return i != ind2;
                });
            } else if (ind2 != -1) // && other != vert
                if (other == vert)
                    vert.connected.splice(ind2, 1);
                else
                    vert.connected[ind2] = other.index;
        });
        this.connected.length = 0;
        level.tiles.filter(function (t) {
            return t.vertices.indexOf(that) != -1;
        }).forEach(function (tile) {
            var ind = tile.vertices.indexOf(that)
            while (ind != -1) {
                tile.vertices[ind] = other;
                var ind = tile.vertices.indexOf(that)
            }
            //tile.draw = function() {};
        });
        other.ori = Vector2.lerp(this.ori, other.ori, 0.5);
        // other.startx = other.ori.x;
        // other.starty = other.ori.y;
        other.pos = Vector2.lerp(this.pos, other.pos, 0.5);
        // other.x = other.pos.x;
        // other.y = other.pos.y;
        delete level.vertices[this.index];
        fix();
    }

    /*Vertex.prototype.niceMerge = function(other, t) {
        this.connected.push(other);
        this.connected.push(other);
        this.connected.push(other);
        var that = this;
        setTimeout(function() {that.merge(other);}, t);
    }*/

    next(current: number, offset: number) {
        var ind = this.connected.indexOf(current);
        if (ind == -1) {
            return undefined;
        }
        return this.connected[(ind + offset + this.connected.length) % this.connected.length];
    }
}

class Frame {
    constructor(
        public tile: Tile,
        public dir: number,
        public pos: Vector2 // 0..1 range
    ) { }

    toScreen() {
        return this.tile.coor_to_screen(this.pos.x, this.pos.y, this.dir);
    }

    toScreenPlusOffset(offset: Vector2) {
        return this.tile.coor_to_screen(this.pos.x + offset.x, this.pos.y + offset.y, this.dir);
    }

    moveX(dist: number): Frame | null {
        var newx = this.pos.x + dist;
        var newtile = this.tile;
        var newdir = this.dir;
        if (newx > 1 || newx < 0) {
            var ind = ((this.dir + 4 + (newx < 0.5 ? 0 : 2)) % 4);
            newtile = this.tile.connected[ind];
            if (!newtile || newtile.wall) {
                return null;
            }
            for (var i = 0; i < 4; i++) {
                if (this.tile == newtile.connected[((4 + i + 2 + ind - this.dir) % 4)]) {
                    newdir = (i) % 4;
                    break;
                }
            }
        }
        return new Frame(newtile, newdir, new Vector2((newx + 2) % 1, this.pos.y))
    }

    moveY(dist: number): Frame | null {
        var newy = this.pos.y + dist;
        var newtile = this.tile;
        var newdir = this.dir;
        if (newy > 1 || newy < 0) {
            var ind = (this.dir + 4 + (newy < 0.5 ? 3 : 1)) % 4;
            newtile = this.tile.connected[ind];
            if (!newtile || newtile.wall) {
                return null
            }
            for (var i = 0; i < 4; i++) {
                if (this.tile == newtile.connected[((6 + i + ind - this.dir) % 4)]) {
                    newdir = (i) % 4;
                    break;
                }
            }
        }
        return new Frame(newtile, newdir, new Vector2(this.pos.x, (newy + 2) % 1))
    }
}



class Player {
    vx: number
    vy: number
    gravity: boolean
    inFunnel: boolean
    frame: Frame

    gpoint: Vertex | null
    goffset?: Vector2 | null
    clos?: Vertex | null
    constructor(x: number, y: number, tile: Tile) {
        this.frame = new Frame(tile, 0, new Vector2(x, y));

        // this.x = x;
        // this.y = y;
        this.vx = 0;
        this.vy = 0;
        // this.tile = tile;
        // this.dir = 0;
        this.gravity = true;
        this.inFunnel = false;

        this.gpoint = null;
        this.goffset = null;
        this.clos = null;
    }


    update(step: number) {
        /*if (arrows.left) 
            this.x -= step * horSpeed;
        if (arrows.right)
            this.x += step * horSpeed;*/
        var wp = this.frame.toScreen(); // this.tile.coor_to_screen(this.x, this.y, this.dir);
        this.clos = closest(wp, this.gpoint!);
        if (arrows.space) {
            if (!this.gpoint) {
                this.gpoint = closest(wp);
                this.goffset = wp.sub(new Vector2(this.gpoint.pos.x, this.gpoint.pos.y));
            } else {
                //console.log("The fuck?");
            }
        } else if (this.gpoint) {
            if (this.gpoint == this.clos) {
                this.gpoint = null;
            } else {
                //if (closest.pos.dist(this.pos) < 5) {
                /*let common = level.tiles.filter(function (el) {
                    return el.contains([this.clos, this.gpoint]);
                }).length;
                clos = this.clos;
                gpoint = this.gpoint;
                console.log(level.tiles);
                console.log(this.clos, this.gpoint);
                console.log(common);
                if (common > 0) {
                    this.gpoint.merge(this.clos);
                    fix();
                }
                this.gpoint = null;*/
            }
            //}
            //this.gpoint = null;
        }
        this.moveX(step, level);
        this.moveY(step, level);
        if (this.gpoint) {
            this.gpoint.pos.x = wp.x - this.goffset!.x;
            this.gpoint.pos.y = wp.y - this.goffset!.y;
        }
    }

    moveX(step: number, level: Level) {
        let dist = this.vx * step;
        if (arrows.left) dist -= step * horSpeed * parity;
        if (arrows.right) dist += step * horSpeed * parity;
        let new_frame = this.frame.moveX(dist);
        if (new_frame) {
            this.frame = new_frame;
        } else {
            this.vx = 0;
        }
        /*var newx = this.x + this.vx * step;
        if (arrows.left)
            newx -= step * horSpeed * parity;
        if (arrows.right)
            newx += step * horSpeed * parity;
        var newtile = this.tile;
        var newdir = this.dir;
        if (newx > 1 || newx < 0) {
            var ind = ((this.dir + 4 + (newx < 0.5 ? 0 : 2)) % 4);
            newtile = this.tile.connected[ind];
            if (!newtile || newtile.wall) {
                this.vx = 0;
                return;
            }
            for (var i = 0; i < 4; i++) {
                if (this.tile == newtile.connected[((4 + i + 2 + ind - this.dir) % 4)]) {
                    newdir = (i) % 4;
                    break;
                }
            }
        }
        this.tile = newtile;
        this.dir = newdir;
        this.x = (newx + 2) % 1;*/
    }

    moveY(step: number, level: Level) {
        let dist = 0;
        if (this.vy > fallThres && this.gravity) {
            this.vy += gravity * step * fallMult
        } else if (this.vy < 0 && !arrows.up && this.gravity) {
            this.vy += gravity * step * fallMult;
        } else if (this.gravity) {
            this.vy += gravity * step
        } else if (!this.gravity) {
            if (arrows.up) dist -= horSpeed * step;
            //this.vy = -horSpeed;
            if (arrows.down) dist += horSpeed * step;
            //this.vy = horSpeed;
        }
        this.vy = Math.min(this.vy, maxSpeed);
        dist += this.vy * step;

        let new_frame = this.frame.moveY(dist);
        if (new_frame) {
            this.frame = new_frame;
        } else {
            this.vy = !arrows.up ? 0 : ((this.frame.pos.y + dist) < 1 ? 0 : -jumpSpeed);
        }
        /*var newy = this.y;
        if (this.vy > fallThres && this.gravity) {
            this.vy += gravity * step * fallMult
        } else if (this.vy < 0 && !arrows.up && this.gravity) {
            this.vy += gravity * step * fallMult;
        } else if (this.gravity) {
            this.vy += gravity * step
        } else if (!this.gravity) {
            if (arrows.up)
                newy = this.y - horSpeed * step;
            //this.vy = -horSpeed;
            if (arrows.down)
                newy = this.y + horSpeed * step;
            //this.vy = horSpeed;
        }
        this.vy = Math.min(this.vy, maxSpeed);
        newy += this.vy * step;
        var newtile = this.tile;
        var newdir = this.dir;
        if (newy > 1 || newy < 0) {
            var ind = (this.dir + 4 + (newy < 0.5 ? 3 : 1)) % 4;
            newtile = this.tile.connected[ind];
            if (!newtile || newtile.wall) {
                this.vy = !arrows.up ? 0 : (newy < 1 ? 0 : -jumpSpeed);
                return;
            }
            for (var i = 0; i < 4; i++) {
                if (this.tile == newtile.connected[((6 + i + ind - this.dir) % 4)]) {
                    newdir = (i) % 4;
                    break;
                }
            }
        }
        this.tile = newtile;
        this.dir = newdir;
        this.y = (newy + 2) % 1;*/
    }

    draw() {
        /*ctx.save();
        var pos = this.tile.c2s(this.x, this.y, this.dir);
        var delta = this.tile.c2s(this.x, 0, this.dir).sub(this.tile.c2s(this.x, 1, this.dir));
        ctx.translate(pos.x,pos.y);
        ctx.rotate(Math.atan2(delta.y, delta.x));
        ctx.fillStyle = "#00FF00";
        var size = 5;
        ctx.fillRect(-size, -size, size*4, size*2);
        ctx.restore();*/
        ctx.beginPath();
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#0000FF";
        var size = .1;

        // var a = this.tile.coor_to_screen(this.x + size, this.y + size * 2, this.dir);
        // var b = this.tile.coor_to_screen(this.x - size, this.y + size * 2, this.dir);
        // var c = this.tile.coor_to_screen(this.x - size, this.y - size * 2, this.dir);
        // var d = this.tile.coor_to_screen(this.x + size, this.y - size * 2, this.dir);

        let a = this.frame.toScreenPlusOffset(new Vector2(size, size * 2));
        let b = this.frame.toScreenPlusOffset(new Vector2(-size, size * 2));
        let c = this.frame.toScreenPlusOffset(new Vector2(-size, -size * 2));
        let d = this.frame.toScreenPlusOffset(new Vector2(size, -size * 2));

        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.lineTo(a.x, a.y);
        ctx.fill();
        ctx.stroke();
    }
}

/*function mouseClicked () {
    selected = selected || underMouse;
    console.log("clicked")
}*/

/*function mapFromVertices(vertices) {
    vertices.forEach(function(el) {
        el.connected = el.connected.sort(function(a, b) {
            var v1 = level.vertices[a];
            var v2 = level.vertices[b];            
            return Math.atan2(v1.y-el.y, v1.x-el.x) - Math.atan2(v2.y-el.y, v2.x-el.x);
        });
    });
    do {
        var v1 = vertices.filter(function(el) {
            return el.connected.length >= 2;
        })[0];
        var v2 = vertices[v1.connected[0]];
        var v3 = vertices[v1.connected[1]];
        var v4 = vertices[v2.connected.filter(function(el) {
            return v3.connected.indexOf(el) != -1 && el != v1.index;
        })[0]];
    } while (!v4);
    tiles = [new Tile(0, v1, v2, v3, v4)]
    return tiles[0]
}*/

class Phys {
    x: number
    y: number
    vx: number
    vy: number
    tile: Tile
    dir: number
    gravity: boolean
    constructor(x: any, y: any, tile: any, dir: number) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.tile = tile;
        this.dir = dir || 0;
        level.physics.push(this);
        this.gravity = true;
    }


    update(step: number) {
        /*this.vx = delta.x;
        this.vy = delta.y;*/
        if (this.gravity) {
            this.vy += step * gravity;
            this.vy = Math.min(this.vy, maxSpeed);
        }
        //console.log(this.vy);
        this.moveX(step);
        this.moveY(step);
    }

    moveX(step: number) {
        var newx = this.x + this.vx * step;
        var newtile = this.tile;
        var newdir = this.dir;
        if (newx > 1 || newx < 0) {
            var ind = ((this.dir + 4 + (newx < 0.5 ? 0 : 2)) % 4);
            newtile = this.tile.connected[ind];
            if (!newtile || newtile.wall) {
                this.vx = 0;
                return;
            }
            for (var i = 0; i < 4; i++) {
                if (this.tile == newtile.connected[((4 + i + 2 + ind - this.dir) % 4)]) {
                    newdir = (i) % 4;
                    break;
                }
            }
        }
        this.tile = newtile;
        this.dir = newdir;
        this.x = (newx + 2) % 1;
    }

    moveY(step: number) {
        var newy = this.y + this.vy * step;
        /*if (this.vy > fallThres) {
            this.vy += gravity * step * fallMult
        } else if (this.vy < 0 && !arrows.up) {
            this.vy += gravity * step * fallMult;
        } else {
            this.vy += gravity * step
        }*/
        var newtile = this.tile;
        var newdir = this.dir;
        if (newy > 1 || newy < 0) {
            var ind = (this.dir + 4 + (newy < 0.5 ? 3 : 1)) % 4;
            newtile = this.tile.connected[ind];
            if (!newtile || newtile.wall) {
                this.vy = 0;
                //this.vy = !arrows.up ? 0 : (newy < 1 ? 0 : -jumpSpeed);
                return;
            }
            for (var i = 0; i < 4; i++) {
                if (this.tile == newtile.connected[((6 + i + ind - this.dir) % 4)]) {
                    newdir = (i) % 4;
                    break;
                }
            }
        }
        this.tile = newtile;
        this.dir = newdir;
        this.y = (newy + 2) % 1;
    }

    draw() {
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#FF00FF";
        var size = .1;
        var a = this.tile.coor_to_screen(this.x + size, this.y + size, this.dir);
        var b = this.tile.coor_to_screen(this.x - size, this.y + size, this.dir);
        var c = this.tile.coor_to_screen(this.x - size, this.y - size, this.dir);
        var d = this.tile.coor_to_screen(this.x + size, this.y - size, this.dir);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.lineTo(a.x, a.y);
        ctx.fill();
        ctx.stroke();
    }
}

// function Funnel(x, y, tile, dir) {
//     this.x = 0.5;
//     this.y = 0;
//     this.tile = tile;
//     this.dir = dir || 0;
//     level.physics.push(this);
// }

// Funnel.prototype.update = function () {
//     path = raycast(this.tile, this.dir, new Vector2(0.5, 0.2), new Vector2(0, 1), 100);
//     var hasPlayer = false;
//     path.forEach(function (seg, ind) {
//         level.physics.filter(function (el) {
//             return Object.getPrototypeOf(el) == Phys.prototype &&
//                 el.tile == seg.tile;
//         }).forEach(function (p) {
//             //console.log(p);
//             var delta = seg.p2.sub(seg.p1).times(2);
//             delta = delta.rotated((p.dir - seg.dir) * Math.PI / 2);
//             p.gravity = false;
//             p.vx = delta.x + (Math.abs(delta.x) == 1 ? 0 : (0.5 - p.x));
//             p.vy = delta.y + (Math.abs(delta.y) == 1 ? 0 : (0.5 - p.y));
//         });

//         if (player.tile == seg.tile) {
//             var p = player;
//             var delta = seg.p2.sub(seg.p1).times(2);
//             delta = delta.rotated((p.dir - seg.dir) * Math.PI / 2);
//             p.gravity = false;
//             p.vx = delta.x + (Math.abs(delta.x) == 1 ? 0 : (0.5 - p.x));
//             p.vy = delta.y + (Math.abs(delta.y) == 1 ? 0 : (0.5 - p.y));
//             hasPlayer = true;
//         } else if (player.gravity == false && hasPlayer == false) {
//             player.gravity = true;
//             player.vx = 0;
//             player.vy = 0;
//         }
//     });
// }

// Funnel.prototype.draw = function () {
//     ctx.beginPath();
//     ctx.strokeStyle = "#000000";
//     ctx.fillStyle = "#00FFFF";
//     var a = this.tile.c2s(0.2, 0, this.dir);
//     var b = this.tile.c2s(0.8, 0, this.dir);
//     var c = this.tile.c2s(0.8, 0.2, this.dir);
//     var d = this.tile.c2s(0.2, 0.2, this.dir);
//     ctx.moveTo(a.x, a.y);
//     ctx.lineTo(b.x, b.y);
//     ctx.lineTo(c.x, c.y);
//     ctx.lineTo(d.x, d.y);
//     ctx.lineTo(a.x, a.y);
//     ctx.fill();
//     ctx.stroke();

//     ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
//     path1 = raycast(this.tile, this.dir, new Vector2(0.2, 0.2), new Vector2(0, 1), 100);
//     path2 = raycast(this.tile, this.dir, new Vector2(0.8, 0.2), new Vector2(0, 1), 100);
//     path1.forEach(function (el1, ind) {
//         var el2 = path2[ind];
//         ctx.beginPath();
//         var a = el1.tile.c2s(el1.p1.x, el1.p1.y, el1.dir);
//         var b = el1.tile.c2s(el1.p2.x, el1.p2.y, el1.dir);
//         var c = el2.tile.c2s(el2.p2.x, el2.p2.y, el2.dir);
//         var d = el2.tile.c2s(el2.p1.x, el2.p1.y, el2.dir);
//         ctx.moveTo(a.x, a.y);
//         ctx.lineTo(b.x, b.y);
//         ctx.lineTo(c.x, c.y);
//         ctx.lineTo(d.x, d.y);
//         //ctx.stroke();
//         ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
//         ctx.fill();
//     });
// }

// function LaserEmit(tile, dir, col) {
//     this.x = 0.5;
//     this.y = 0;
//     this.tile = tile;
//     this.dir = dir || 0;
//     level.physics.push(this);
//     this.lastCatch = null;
//     this.col = col || "#FF0000";
// }

// LaserEmit.prototype.draw = function () {
//     ctx.beginPath();
//     ctx.strokeStyle = "#000000";
//     ctx.fillStyle = this.col;
//     var a = this.tile.c2s(0.35, 0, this.dir);
//     var b = this.tile.c2s(0.65, 0, this.dir);
//     var c = this.tile.c2s(0.55, 0.2, this.dir);
//     var d = this.tile.c2s(0.45, 0.2, this.dir);
//     ctx.moveTo(a.x, a.y);
//     ctx.lineTo(b.x, b.y);
//     ctx.lineTo(c.x, c.y);
//     ctx.lineTo(d.x, d.y);
//     ctx.lineTo(a.x, a.y);
//     ctx.fill();
//     ctx.stroke();

//     //ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
//     path1 = raycast(this.tile, this.dir, new Vector2(0.45, 0.2), new Vector2(0, 1), 100);
//     path2 = raycast(this.tile, this.dir, new Vector2(0.55, 0.2), new Vector2(0, 1), 100);
//     path1.forEach(function (el1, ind) {
//         var el2 = path2[ind];
//         ctx.beginPath();
//         var a = el1.tile.c2s(el1.p1.x, el1.p1.y, el1.dir);
//         var b = el1.tile.c2s(el1.p2.x, el1.p2.y, el1.dir);
//         var c = el2.tile.c2s(el2.p2.x, el2.p2.y, el2.dir);
//         var d = el2.tile.c2s(el2.p1.x, el2.p1.y, el2.dir);
//         ctx.moveTo(a.x, a.y);
//         ctx.lineTo(b.x, b.y);
//         ctx.lineTo(c.x, c.y);
//         ctx.lineTo(d.x, d.y);
//         //ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
//         ctx.fill();
//     });
// }

// LaserEmit.prototype.update = function () {
//     path = raycast(this.tile, this.dir, new Vector2(0.5, 0.2), new Vector2(0, 1), 100);
//     var that = this;
//     var hasPlayer = false;
//     if (this.lastCatch)
//         this.lastCatch.active = false;
//     path.forEach(function (seg, ind) {
//         that.lastCatch = level.physics.filter(function (el) {
//             return Object.getPrototypeOf(el) == LaserCatch.prototype &&
//                 el.tile == seg.tile && that.col == el.col;
//         })[0];
//         if (that.lastCatch) {
//             that.lastCatch.active = true;
//         }

//         /*if (player.tile == seg.tile) {
//             var p = player;
//             var delta = seg.p2.sub(seg.p1).times(2);
//             delta = delta.rotated((p.dir-seg.dir) * Math.PI/2);
//             p.gravity = false;
//             p.vx = delta.x + (Math.abs(delta.x) == 1 ? 0 : (0.5 - p.x));
//             p.vy = delta.y + (Math.abs(delta.y) == 1 ? 0 : (0.5 - p.y));
//             hasPlayer = true;
//         } else if (player.gravity == false && hasPlayer == false) {
//             player.gravity = true;
//             player.vx = 0;
//             player.vy = 0;
//         }*/
//     });
// }

// function LaserCatch(tile, dir, col, darker) {
//     this.tile = tile;
//     this.dir = dir || 0;
//     level.physics.push(this);
//     this.active = false;
//     this.col = col || "#FF0000";
//     this.darker = darker || "#550000";
// }

// LaserCatch.prototype.update = function () {
//     //this.active = false;
// }

// LaserCatch.prototype.draw = function () {
//     ctx.beginPath();
//     ctx.strokeStyle = "#000000";
//     ctx.fillStyle = this.active ? this.col : this.darker;
//     //ctx.fillStyle = this.active ? this.col : "black";
//     //ctx.fillStyle = this.col;
//     var a = this.tile.c2s(0.3, 0, this.dir);
//     var b = this.tile.c2s(0.7, 0, this.dir);
//     var c = this.tile.c2s(0.7, 0.2, this.dir);
//     var d = this.tile.c2s(0.3, 0.2, this.dir);
//     ctx.moveTo(a.x, a.y);
//     ctx.lineTo(b.x, b.y);
//     ctx.lineTo(c.x, c.y);
//     ctx.lineTo(d.x, d.y);
//     ctx.lineTo(a.x, a.y);
//     ctx.fill();
//     ctx.stroke();
// }

function fix() {
    level.vertices.forEach(function (el) {
        el.connected = el.connected.sort(function (a, b) {
            var v1 = level.vertices[a];
            var v2 = level.vertices[b];
            return v1.pos.sub(el.pos).getRadians() - v2.pos.sub(el.pos).getRadians();
        });
    });
    for (var i = 0; i < 4; i++) {
        level.tiles.forEach(function (el, ind) {
            var v0 = el.vertices[i];
            var v1 = el.vertices[(i + 1) % 4];
            var v2 = level.vertices[v0.next(v1.index, 1 * parity)!];
            var v3 = level.vertices[v1.next(v0.index, -1 * parity)!];
            el.connected[i] = level.tiles.filter(function (t) {
                return t.contains([v0, v1, v2, v3]);
            })[0];
        });
    }
    /*level.tiles.forEach(function(el, ind) {
        var v0 = el.vertices[0];
        var v1 = el.vertices[1];
        var v2 = level.vertices[v0.next(v1.index, 1)];
        var v3 = level.vertices[v1.next(v0.index, -1)];
        el.connected[1] = level.tiles.filter(function(t) {
            return t.contains([v0,v1,v2, v3]);
        })[0];
    });*/
}

function fixTris() {
    //fix();
    var toMerge: Vertex[][] = [];
    level.tiles.forEach(function (el, ind) {
        for (var i = 0; i < 4; i++) {
            if (el.vertices[i] == el.vertices[(i + 1) % 4]) {
                if (el.vertices[i] == el.vertices[(i + 2) % 4] ||
                    el.vertices[i] == el.vertices[(i + 3) % 4]) {
                } else {
                    toMerge.push([el.vertices[(i + 2) % 4], el.vertices[(i + 3) % 4]]);
                    delete level.tiles[ind];
                }
            }
        }
    });
    toMerge.forEach(function (el) {
        el[0].merge(el[1]);
        //el[0].niceMerge(el[1], 125);
    });
    if (toMerge.length != 0) {
        console.log(toMerge);
        setTimeout(fixTris, 250);
    }
}

function raycast(startTile: Tile, startDir: number, rayPos: Vector2, rayDir: Vector2, maxit: number) {
    var result = [];
    var dx = rayDir.x / Math.abs(rayDir.y);
    var dy = rayDir.y / Math.abs(rayDir.x);
    var p1 = new Vector2(rayPos.x + (1 - rayPos.y) * rayDir.x / rayDir.y, rayDir.y > 0 ? 1 : 0);
    if (rayDir.y < 0) {
        p1.x = rayPos.x + rayPos.y * rayDir.x / -rayDir.y;
    }
    var p2 = new Vector2(rayDir.x > 0 ? 1 : 0, rayPos.y + (1 - rayPos.x) * rayDir.y / rayDir.x);
    if (rayDir.x < 0) {
        p2.y = rayPos.y + rayPos.x * rayDir.y / -rayDir.x;
    }

    for (var k = 0; k < maxit; k++) {
        if (0 <= p1.x && p1.x <= 1) {
            result.push({ tile: startTile, dir: startDir, p1: new Vector2(rayPos.x, rayPos.y), p2: new Vector2(p1.x, p1.y) });
            rayPos.x = p1.x;
            rayPos.y = rayDir.y > 0 ? 0 : 1;
            var index = (startDir + 12 + (rayDir.y > 0 ? 1 : 3)) % 4;
            var newFace = startTile.connected[index];
            if (newFace == null || newFace.wall) {
                break;
            }
            for (var i = 0; i < 4; i++) {
                if (startTile == newFace.connected[(4 + i + 2 + index - startDir) % 4]) {
                    startDir = (i) % 4;
                    break;
                }
            }
            startTile = newFace;
            p1.x += dx;
            p2.y += rayDir.y > 0 ? -1 : 1;
        } else {
            result.push({ tile: startTile, dir: startDir, p1: new Vector2(rayPos.x, rayPos.y), p2: new Vector2(p2.x, p2.y) });
            rayPos.x = rayDir.x > 0 ? 0 : 1;
            rayPos.y = p2.y;
            var index = (startDir + 12 + (rayDir.x > 0 ? 2 : 0)) % 4;
            var newFace = startTile.connected[index];
            if (newFace == null || newFace.wall) {
                break;
            }
            for (var i = 0; i < 4; i++) {
                if (startTile == newFace.connected[(4 + i + 2 + index - startDir) % 4]) {
                    startDir = (i) % 4;
                    break;
                }
            }
            startTile = newFace;
            p2.y += dy;
            p1.x += rayDir.x > 0 ? -1 : 1;
        }
    }
    return result;
}

function teleportPlayer() {
    let p = new Vector2(mouse.x, mouse.y);
    let f = level.tiles.filter(function (el) {
        return el.containsPoint(p);
    })[0];
    let v = f.invBilinear(p, player.frame.dir);
    player.frame.pos.x = v.x;
    player.frame.pos.y = v.y;
    player.frame.tile = f;
}

function mousetile() {
    let p = new Vector2(mouse.x, mouse.y);
    return level.tiles.filter(function (el) {
        return el.containsPoint(p);
    })[0].index;
}

function updatetile() {
    let p = new Vector2(mouse.x, mouse.y);
    let t = level.tiles.filter(function (el) {
        return el.containsPoint(p);
    })[0];
    if (t)
        t.value = (t.value + 1) % 3;
}

function closest(pos: Vector2, avoid?: Vertex) {
    return level.vertices.reduce(function (cur, min) {
        return (cur != avoid && cur.pos.distanceTo(pos) < min.pos.distanceTo(pos)) ? cur : min;
    });
}

// UTILITY

function trackKeys(codes: any) {
    var pressed = Object.create(null);
    function handler(event: { keyCode: string | number; type: string; preventDefault: () => void; }) {
        if (codes.hasOwnProperty(event.keyCode)) {
            var down = event.type == "keydown";
            pressed[codes[event.keyCode]] = down;
            event.preventDefault();
        }
    }
    addEventListener("keydown", handler);
    addEventListener("keyup", handler);
    return pressed;
}

function runAnimation(frameFunc: { (time: number): boolean; (arg0: number): boolean; }) {
    var lastTime: number | null = null;
    function frame(time: number) {
        var stop = false;
        if (lastTime != null) {
            var timeStep = Math.min(time - lastTime, 100) / 1000;
            stop = frameFunc(timeStep) === false;
        }
        lastTime = time;
        if (!stop)
            requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

function download(text: BlobPart, name: string, type: any) {
    var a = document.createElement("a");
    var file = new Blob([text], { type: type });
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
}

var level = new Level(LEVEL_DATA);
var player = new Player(.5, .5, level.tiles[12] || level.tiles[0]);
player.frame.dir = 3;