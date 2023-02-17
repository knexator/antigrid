import * as dat from 'dat.gui';
import Shaku from "shaku/lib/shaku";
import { BlendModes, drawSprite, TextureFilterModes, Vertex, whiteTexture } from "shaku/lib/gfx";
import TextureAsset from "shaku/lib/assets/texture_asset";
import Color from "shaku/lib/utils/color";
import Vector2 from "shaku/lib/utils/vector2";
import Sprite from "shaku/lib/gfx/sprite";
import { gfx, input } from 'shaku';
import Circle from 'shaku/lib/utils/circle';
import { KeyboardKeys } from 'shaku/lib/input/key_codes';
import Animator from 'shaku/lib/utils/animator';
import { lerp, mod } from 'shaku/lib/utils/math_helper';

const CONFIG = {
    // Grid visuals
    resolution: 3,
    tile_size: 80,
    grid_offset: new Vector2(0, 0),

    // Grid elasticity
    spring: 1.0,
    force: 90.00,
    friction: 8.5,

    // Player
    player_speed: 4.0,

    // Debug & development
    editor: true,
};
let gui = new dat.GUI({});
gui.remember(CONFIG);
gui.add(CONFIG, "spring", 0, 1);
gui.add(CONFIG, "force", 0, 200);
gui.add(CONFIG, "friction", 0, 10);
gui.hide();

// init shaku
await Shaku.init();

// add shaku's canvas to document and set resolution to 800x600
document.body.appendChild(Shaku!.gfx!.canvas);
Shaku.gfx!.setResolution(800, 600, true);
Shaku.gfx!.centerCanvas();
// Shaku.gfx!.maximizeCanvasSize(false, false);

// Load resources
// (no resources yet)


// Define game types

// Side and corner indices:
//   [2]         [3]
//  (0,0) -[3]- (1,0)
//    |           |
//    |           |
//   [2]         [0]
//    |           |
//    |           |
//  (0,1) -[1]- (1,1) 
//   [1]         [0]

type direction = 0 | 1 | 2 | 3;

const DIRS: Record<direction, Vector2> = [
    Vector2.right,
    Vector2.down,
    Vector2.left,
    Vector2.up
];

const DI: Record<direction, number> = [1, 0, -1, 0];
const DJ: Record<direction, number> = [0, 1, 0, -1];

// hacky
// this gives the i,j of the corner in "direction - 45º"
const DI_CORNER: Record<direction, number> = [1, 0, 0, 1];
const DJ_CORNER: Record<direction, number> = [1, 1, 0, 0];

function oppDir(dir: direction): direction {
    return ((2 + dir) % 4) as direction;
}

function rotateDir(dir: direction, by: direction): direction {
    return ((dir + by) % 4) as direction;
}

function ccwDir(dir: direction): direction {
    return rotateDir(dir, 1);
}

function cwDir(dir: direction): direction {
    return rotateDir(dir, 3);
}

function localPos(pos: Vector2): boolean {
    return pos.x >= 0 && pos.x < 1 && pos.y >= 0 && pos.y < 1;
}

/** Spatial game data */
class Grid {
    public tiles: Tile[][];
    public corners: Corner[][];
    constructor(
        public w: number,
        public h: number,
    ) {
        this.corners = makeRectArrayFromFunction<Corner>(w + 1, h + 1, (i, j) => {
            return new Corner(
                i, j,
                CONFIG.grid_offset.add(i * CONFIG.tile_size, j * CONFIG.tile_size),
                i == 0 || j == 0 || i == w || j == h
            )
        });
        this.tiles = makeRectArrayFromFunction<Tile>(w, h, (i, j) => new Tile(i, j, false)); //i === 0 || i === w - 1 || j === 0 || j === h - 1));
    }

    draw() {
        for (let j = 0; j < this.h; j++) {
            for (let i = 0; i < this.w; i++) {
                let tile = this.tiles[j][i];
                if (tile.wall) {
                    // todo: fill with solid color instead
                    let N = 10;
                    for (let k = 0; k <= N; k++) {
                        gfx.drawLines([
                            this.frame2screen(new Frame(tile, new Vector2(0, k / N), 0)),
                            this.frame2screen(new Frame(tile, new Vector2(1, k / N), 0)),

                            this.frame2screen(new Frame(tile, new Vector2(k / N, 0), 0)),
                            this.frame2screen(new Frame(tile, new Vector2(k / N, 1), 0)),
                        ], Color.black);
                    }
                } else {
                    gfx.drawLinesStrip([
                        this.frame2screen(new Frame(tile, Vector2.zero, 0)),
                        this.frame2screen(new Frame(tile, Vector2.right, 0)),
                        this.frame2screen(new Frame(tile, Vector2.one, 0)),
                        this.frame2screen(new Frame(tile, Vector2.down, 0)),
                        this.frame2screen(new Frame(tile, Vector2.zero, 0)),
                    ], Color.black);
                }
            }
        }

        /*for (let j = 1; j < this.h - 1; j++) {
            for (let i = 1; i < this.w - 1; i++) {
                this.tiles[j][i].drawBackground();
            }
        }*/
    }

    update(dt: number) {
        dt = clamp(dt, 0, .01);
        // for each non-border corner...
        for (let j = 2; j < this.h - 1; j++) {
            for (let i = 2; i < this.w - 1; i++) {
                let corner = this.corners[j][i];
                // move to connected corners
                for (let d = 0; d < 4; d++) {
                    let other = this.corners[j + DJ[d as direction]][i + DI[d as direction]];
                    corner.force.addSelf(other.pos.sub(corner.pos).mul(CONFIG.force));
                    // corner.pos.addSelf(other.pos.sub(corner.pos).mul(dt * CONFIG.force));
                    // this.almostForceDistanceBetweenCorners(corner, other, CONFIG.tile_size, .3);
                }
            }
        }

        for (let j = 1; j < this.h; j++) {
            for (let i = 1; i < this.w; i++) {
                let corner = this.corners[j][i];
                corner.update(dt);
            }
        }

        // this.almostForceDistanceBetweenCorners(this.corners[3][3], this.corners[3 + 1][3 + 1], (1 - .95) * Math.SQRT2 * CONFIG.tile_size);
        // this.almostForceDistanceBetweenCorners(this.corners[3 + 1][3], this.corners[3][3 + 1], Math.SQRT2 * CONFIG.tile_size * (.95 * .3 + 1));

        /*
        if (THINGY > 0) {
            this.forceDistanceBetweenCorners(this.corners[SJ][SI], this.corners[SJ + 1][SI + 1], (1 - THINGY) * Math.SQRT2 * TILE_SIZE);
            this.forceDistanceBetweenCorners(this.corners[SJ + 1][SI], this.corners[SJ][SI + 1], Math.SQRT2 * TILE_SIZE * (THINGY * .3 + 1));
        }
        if (THINGY < 0) {
            this.forceDistanceBetweenCorners(this.corners[SJ + 1][SI], this.corners[SJ][SI + 1], (1 + THINGY) * Math.SQRT2 * TILE_SIZE);
            this.forceDistanceBetweenCorners(this.corners[SJ][SI], this.corners[SJ + 1][SI + 1], Math.SQRT2 * TILE_SIZE * (-THINGY * .3 + 1));
        }
        if (THINGY === 0) {
            this.forceDistanceBetweenCorners(this.corners[SJ + 1][SI], this.corners[SJ][SI + 1], Math.SQRT2 * TILE_SIZE);
            this.forceDistanceBetweenCorners(this.corners[SJ][SI], this.corners[SJ + 1][SI + 1], Math.SQRT2 * TILE_SIZE);
        }
        */

        /*for (let j = 1; j < this.h - 1; j++) {
            for (let i = 1; i < this.w - 1; i++) {
                this.tiles[j][i].updateSprites();
            }
        }*/
    }

    almostForceDistanceBetweenCorners(c1: Corner, c2: Corner, target_dist: number, relative_error: number = .05) {
        // they will be in 5% of target_dist
        let delta = c1.pos.sub(c2.pos);
        let dist = delta.length;
        if (dist === 0) return;
        target_dist = moveTowards(target_dist, dist, dist * relative_error);
        let diff = (target_dist - dist) / dist;

        /*c1.vel.set(0, 0);
        c1.force.set(0, 0);
        c2.vel.set(0, 0);
        c2.force.set(0, 0);*/

        if (c2.fixed) {
            c1.pos.addSelf(delta.mul(diff * CONFIG.spring));
        } else {
            let move = delta.mul(diff * 0.5 * CONFIG.spring);
            c1.pos.addSelf(move);
            c2.pos.subSelf(move);
        }
    }

    forceDistanceBetweenCorners(c1: Corner, c2: Corner, target_dist: number) {
        let delta = c1.pos.sub(c2.pos);
        let dist = delta.length;
        if (dist === 0) return;
        let diff = (target_dist - dist) / dist;

        /*c1.vel.set(0, 0);
        c1.force.set(0, 0);
        c2.vel.set(0, 0);
        c2.force.set(0, 0);*/

        if (c2.fixed) {
            c1.pos.addSelf(delta.mul(diff * CONFIG.spring));
        } else {
            let move = delta.mul(diff * 0.5 * CONFIG.spring);
            c1.pos.addSelf(move);
            c2.pos.subSelf(move);
        }
    }

    screen2frame(screen_pos: Vector2): Frame | null {
        for (let j = 0; j < this.h; j++) {
            for (let i = 0; i < this.w; i++) {
                let tile = this.tiles[j][i];
                let local_pos = tile.invBilinear(screen_pos);
                if (local_pos === null) continue;
                return new Frame(tile, local_pos, 0);
            }
        }
        return null;
    }

    frame2screen(frame: Frame): Vector2 {
        frame = frame.clone().redir(0);
        let y_high = Vector2.lerp(frame.tile.corner(1).pos, frame.tile.corner(0).pos, frame.pos.x);
        let y_low = Vector2.lerp(frame.tile.corner(2).pos, frame.tile.corner(3).pos, frame.pos.x);
        return Vector2.lerp(y_low, y_high, frame.pos.y);
    }

    frame2screenDirX(frame: Frame): Vector2 {
        // real direction
        let x_low = Vector2.lerp(frame.tile.corner(rotateDir(2, frame.dir)).pos, frame.tile.corner(rotateDir(1, frame.dir)).pos, frame.pos.y);
        let x_high = Vector2.lerp(frame.tile.corner(rotateDir(3, frame.dir)).pos, frame.tile.corner(rotateDir(0, frame.dir)).pos, frame.pos.y);
        return x_high.sub(x_low).normalizeSelf();
    }

    frame2screenDirY(frame: Frame): Vector2 {
        // real direction
        let y_low = Vector2.lerp(frame.tile.corner(rotateDir(2, frame.dir)).pos, frame.tile.corner(rotateDir(3, frame.dir)).pos, frame.pos.x);
        let y_high = Vector2.lerp(frame.tile.corner(rotateDir(1, frame.dir)).pos, frame.tile.corner(rotateDir(0, frame.dir)).pos, frame.pos.x);
        return y_high.sub(y_low).normalizeSelf();
    }

    frame2screenDirs(frame: Frame): Color {
        let dir_x = this.frame2screenDirX(frame);
        let dir_y = this.frame2screenDirY(frame);
        return new Color(dir_x.x, dir_x.y, dir_y.x, dir_y.y);
    }
}

class Corner {
    // private prev_pos: Vector2;
    public vel: Vector2;
    public force: Vector2;
    constructor(
        public i: number,
        public j: number,
        public pos: Vector2,
        public fixed: boolean,
    ) {
        // this.prev_pos = pos.clone();
        this.vel = Vector2.zero;
        this.force = Vector2.zero;
    }

    /*updatePos() {
        // if (this.i !== 3 && this.i !== 4) return;
        // if (this.j !== 3 && this.j !== 4) return;
        if (this.i === 3 && this.j === 3) {
            this.pos.copy(OFFSET.add(TILE_SIZE * 3, TILE_SIZE * 3).add(new Vector2(.5, .5).mulSelf(TILE_SIZE * THINGY)));
        }
        if (this.i === 4 && this.j === 4) {
            this.pos.copy(OFFSET.add(TILE_SIZE * 4, TILE_SIZE * 4).add(new Vector2(-.5, -.5).mulSelf(TILE_SIZE * THINGY)));
        }

        if (this.i === 3 && this.j === 4) {
            this.pos.copy(OFFSET.add(TILE_SIZE * 3, TILE_SIZE * 4).add(new Vector2(-.5, .5).mulSelf(TILE_SIZE * THINGY)));
        }
        if (this.i === 4 && this.j === 3) {
            this.pos.copy(OFFSET.add(TILE_SIZE * 4, TILE_SIZE * 3).add(new Vector2(.5, -.5).mulSelf(TILE_SIZE * THINGY)));
        }
    }*/

    update(dt: number) {
        this.vel.addSelf(this.force.mul(dt));
        this.pos.addSelf(this.vel.mul(dt));
        this.force.set(0, 0);
        this.vel.mulSelf(1 / (1 + (dt * CONFIG.friction)))
    }
}

class Tile {
    // public sprites: Sprite[][];
    // public verts: Vector2[][];
    constructor(
        public i: number,
        public j: number,
        // Game logic
        public wall: boolean,
    ) {
        /*this.verts = makeRectArrayFromFunction<Vector2>(RESOLUTION + 1, RESOLUTION + 1, (i, j) => {
            return Vector2.zero;
        });

        this.sprites = makeRectArrayFromFunction<Sprite>(RESOLUTION, RESOLUTION, (i, j) => {
            let sprite = new Sprite(cars_texture);
            sprite.static = true;
            let uv_top_left = new Vector2(i / RESOLUTION, j / RESOLUTION);
            let uv_bottom_right = new Vector2((i + 1) / RESOLUTION, (j + 1) / RESOLUTION);
            sprite._cachedVertices = [
                // @ts-ignore
                new Vertex(this.verts[j][i], uv_top_left), // topLeft
                // @ts-ignore
                new Vertex(this.verts[j][i + 1]), // topRight
                // @ts-ignore
                new Vertex(this.verts[j + 1][i]), // bottomLeft
                // @ts-ignore
                new Vertex(this.verts[j + 1][i + 1], uv_bottom_right), // bottomRight
            ];
            sprite.color = [
                new Color(1, 0, 0, 1), // topLeft
                new Color(1, 0, 0, 1), // topRight
                new Color(1, 0, 0, 1), // bottomLeft
                new Color(1, 0, 0, 1), // bottomRight
            ]
            return sprite;
        });*/
    }

    adjacent(dir: direction, ignore_gimmmicks: boolean = false): Tile | null {
        let ni = this.i + DI[dir];
        let nj = this.j + DJ[dir];
        if (ni < 0 || ni >= grid.w || nj < 0 || nj >= grid.h) return null;

        let result = grid.tiles[nj][ni]
        if (ignore_gimmmicks) {
            return result;
        }

        let gimmick = gimmicks.find(x => x.tile === result);
        if (gimmick === undefined || gimmick.folded < .7) {
            return result;
        }

        // found via writing down all cases
        let magic_bool = (gimmick.corner % 2) == (dir % 2);

        return result.adjacent(magic_bool ? cwDir(dir) : ccwDir(dir));
    }

    corner(dir: direction): Corner {
        let ni = this.i + DI_CORNER[dir];
        let nj = this.j + DJ_CORNER[dir];
        return grid.corners[nj][ni];
    }

    /*updateSprites() {
        let temp_frame = new Frame(this, Vector2.zero, 0);
        for (let j = 0; j <= RESOLUTION; j++) {
            for (let i = 0; i <= RESOLUTION; i++) {
                temp_frame.pos.set(i / RESOLUTION, j / RESOLUTION);
                this.verts[j][i].copy(grid.frame2screen(temp_frame))
            }
        }
    }

    drawBackground() {
        // return
        Shaku.gfx.useEffect(background_effect);

        this.drawSprites();

        // @ts-ignore
        Shaku.gfx.useEffect(null);
    }

    drawSprites() {
        for (let j = 0; j < RESOLUTION; j++) {
            for (let i = 0; i < RESOLUTION; i++) {
                Shaku.gfx.drawSprite(this.sprites[j][i]);
            }
        }
        Shaku.gfx.spritesBatch.end();
    }*/

    // from https://iquilezles.org/articles/ibilinear/
    invBilinear(screen_pos: Vector2): Vector2 | null {
        let a = this.corner(2).pos;
        let b = this.corner(3).pos;
        let c = this.corner(0).pos;
        let d = this.corner(1).pos;

        let e = b.sub(a);
        let f = d.sub(a);
        let g = a.sub(b).add(c).sub(d);
        let h = screen_pos.sub(a);

        let k2 = Vector2.cross(g, f);
        let k1 = Vector2.cross(e, f) + Vector2.cross(h, g);
        let k0 = Vector2.cross(h, e);

        // if edges are parallel, this is a linear equation
        if (Math.abs(k2) < 0.001) {
            let u = (h.x * k1 + f.x * k0) / (e.x * k1 - g.x * k0);
            let v = -k0 / k1;
            if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) {
                return null;
            }
            return new Vector2(u, v);
        }
        // otherwise, it's a quadratic
        else {
            let w = k1 * k1 - 4.0 * k0 * k2;
            if (w < 0.0) return null;
            w = Math.sqrt(w);

            let ik2 = 0.5 / k2;
            let v = (-k1 - w) * ik2;
            let u = (h.x - f.x * v) / (e.x + g.x * v);

            if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) {
                v = (-k1 + w) * ik2;
                u = (h.x - f.x * v) / (e.x + g.x * v);

                if (u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) {
                    return null;
                }
            }
            return new Vector2(u, v);
        }
    }
}

/** Frame of reference: position and rotation */
class Frame {
    constructor(
        public tile: Tile,
        /** Both coordinates are in [0, 1) */
        public pos: Vector2,
        /** Relative to the current tile; 90° ccw would be a dir of 1 (since the frame's "right" is the tile's "up" (1)) */
        public dir: direction,
    ) { }

    redir(new_dir: direction): Frame {
        while (this.dir !== new_dir) {
            this.rotccw();
        }
        return this;
    }

    rotccw(): Frame {
        this.dir = (this.dir + 1) % 4 as direction;
        this.pos.set(
            this.pos.y,
            1.0 - this.pos.x
        )
        return this;
    }

    move(dir: direction, dist: number): Frame | null {
        // all grid logic goes here
        // console.log(dist);
        if (dist < 0) {
            return this.move(oppDir(dir), -dist);
        }
        if (dist === 0) return this;
        if (dist >= 1) {
            return this.move(dir, .75)?.move(dir, dist - .75) || null;
        }

        let new_pos = this.pos.add(DIRS[dir].mul(dist));
        if (localPos(new_pos)) {
            this.pos = new_pos;
            return this;
        } else {
            // we went out of the tile
            let new_tile = this.tile.adjacent(rotateDir(dir, this.dir));
            if (new_tile === null) return null;

            // go back to a 0..1 position
            this.pos = new_pos.sub(DIRS[dir]);
            // this.pos.x = mod(new_pos.x, 1);
            // this.pos.y = mod(new_pos.y, 1);
            if (!localPos(this.pos)) {
                // if new_pos has -0.00...01, then it goes to 1, not to 0.99...99
                console.log("implementation error in Frame.move, this should be a local pos: ", this.pos.x, this.pos.y, " distance was: ", dist, " new pos was: ", new_pos.x, new_pos.y);
                // throw new Error("implementation error in Frame.move");
            }

            // going back should bring us back; if not, correct direction
            let k = 0;
            while (new_tile.adjacent(rotateDir(oppDir(dir), this.dir), k > 4) !== this.tile) {
                this.dir = rotateDir(this.dir, 1);
                k++;
                if (k > 12) {
                    console.log("no valid adjacent?? we must be coming from folded tile");
                    break;
                }
            }
            this.tile = new_tile;

            return this;
        }
    }

    clone() {
        return new Frame(this.tile, this.pos.clone(), this.dir);
    }
}

const ropeColor = Color.cyan;
/** The two rings situated on the corners of a tile, and the rope connecting them. */
class Gimmick {
    constructor(
        public tile: Tile,
        /** if the rings extended, they would meet at this corner */
        public corner: direction,
        public peg1: Peg,
        public peg2: Peg,
        /** Between 0 & 1 */
        public folded: number = 0,
    ) {
        peg1.used = true;
        peg2.used = true;
    }

    draw() {
        // ring 1
        gfx.drawLinesStrip([
            grid.frame2screen(new Frame(this.tile, new Vector2(0.0, .99), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(0.2, .90), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(0.4, .99), this.corner)),
            grid.frame2screen(new Frame(this.tile.adjacent(ccwDir(this.corner), true)!, new Vector2(0.2, .1), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(0.0, .99), this.corner)),
        ], Color.black);

        // ring 2
        gfx.drawLinesStrip([
            grid.frame2screen(new Frame(this.tile, new Vector2(.99, 0.0), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(.90, 0.2), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(.99, 0.4), this.corner)),
            grid.frame2screen(new Frame(this.tile.adjacent(this.corner, true)!, new Vector2(.1, 0.2), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(.99, 0.0), this.corner)),
        ], Color.black);

        // inner rope
        gfx.drawLinesStrip([
            grid.frame2screen(new Frame(this.tile, new Vector2(0.2, .99), this.corner)),
            grid.frame2screen(new Frame(this.tile, new Vector2(.99, 0.2), this.corner)),
        ], ropeColor);

        // end 1 & rope
        if (player.holding === this && player.holding_side === 1) {
            // rope
            gfx.drawLinesStrip([
                grid.frame2screen(new Frame(this.tile, new Vector2(0.2, .99), this.corner)),
                grid.frame2screen(player.frame),
            ], ropeColor);

            // ball
            Shaku.gfx.fillCircle(new Circle(grid.frame2screen(player.frame), CONFIG.tile_size * .1), ropeColor);
        } else {
            // rope            
            gfx.drawLinesStrip([
                grid.frame2screen(new Frame(this.tile, new Vector2(0.2, .99), this.corner)),
                grid.frame2screen(new Frame(this.peg1.tile, Vector2.half, 0)),
            ], ropeColor);

            // ball
            Shaku.gfx.fillCircle(new Circle(grid.frame2screen(new Frame(this.peg1.tile, Vector2.half, 0)), CONFIG.tile_size * .1), ropeColor);
        }

        // end 2
        if (player.holding === this && player.holding_side === 2) {
            // rope
            gfx.drawLinesStrip([
                grid.frame2screen(new Frame(this.tile, new Vector2(.99, 0.2), this.corner)),
                grid.frame2screen(player.frame),
            ], ropeColor);

            // ball
            Shaku.gfx.fillCircle(new Circle(grid.frame2screen(player.frame), CONFIG.tile_size * .1), ropeColor);
        } else {
            // rope            
            gfx.drawLinesStrip([
                grid.frame2screen(new Frame(this.tile, new Vector2(.99, 0.2), this.corner)),
                grid.frame2screen(new Frame(this.peg2.tile, Vector2.half, 0)),
            ], ropeColor);

            // ball
            Shaku.gfx.fillCircle(new Circle(grid.frame2screen(new Frame(this.peg2.tile, Vector2.half, 0)), CONFIG.tile_size * .1), ropeColor);
        }
    }
}

class Player {
    public holding: Gimmick | null;
    public holding_side: 1 | 2 | null;
    constructor(
        public frame: Frame,
    ) {
        this.holding = null;
        this.holding_side = null;
    }

    draw() {
        // triangle pointing up
        gfx.drawLinesStrip([
            grid.frame2screen(this.frame.clone().move(1, -.4)!),
            grid.frame2screen(this.frame.clone().move(0, .2)!.move(1, .4)!),
            grid.frame2screen(this.frame.clone().move(0, -.2)!.move(1, .4)!),
            grid.frame2screen(this.frame.clone().move(1, -.4)!), // close the loop
        ], Color.magenta);
    }
}

class Peg {
    public used: boolean;
    constructor(
        public tile: Tile,
    ) {
        this.used = false;
    }

    draw() {
        Shaku.gfx.outlineCircle(new Circle(grid.frame2screen(new Frame(this.tile, Vector2.half, 0)), CONFIG.tile_size * .1), Color.black);
    }
}

/** single tile */
class Stairs {
    constructor(
        public tile: Tile,
        public vertical: boolean = true,
    ) { }

    draw() {
        let frame = new Frame(this.tile, Vector2.half, this.vertical ? 0 : 1);
        gfx.drawLines([
            // left bar
            grid.frame2screen(frame.clone().move(2, .2)!.move(1, .4)!),
            grid.frame2screen(frame.clone().move(2, .2)!.move(3, .4)!),
            // right bar
            grid.frame2screen(frame.clone().move(0, .2)!.move(1, .4)!),
            grid.frame2screen(frame.clone().move(0, .2)!.move(3, .4)!),
        ], Color.black);

        for (let k = -1; k <= 1; k++) {
            gfx.drawLines([
                grid.frame2screen(frame.clone().move(0, .2)!.move(1, k * .2)!),
                grid.frame2screen(frame.clone().move(2, .2)!.move(1, k * .2)!),
            ], Color.black);
        }
    }
}

let grid = new Grid(8, 8);
/*for (let j = 0; j < grid.h; j++) {
    for (let i = 0; i < grid.w; i++) {
        grid.tiles[j][i].updateSprites();
    }
}*/
// grid.tiles[3][7].wall = false;

grid.tiles[5][2].wall = true;

let pegs = [
    new Peg(grid.tiles[2][3]),
    new Peg(grid.tiles[1][2]),
    new Peg(grid.tiles[1][4]),

    new Peg(grid.tiles[3][4]),
    new Peg(grid.tiles[2][5]),
    new Peg(grid.tiles[4][4]),

    new Peg(grid.tiles[2][4]),
];

let gimmicks: Gimmick[] = [
    new Gimmick(grid.tiles[2][2], 3, pegs[0], pegs[1]),

    new Gimmick(grid.tiles[2][4], 0, pegs[3], pegs[4]),
];

let stairs = [
    new Stairs(grid.tiles[2][2]),
    new Stairs(grid.tiles[3][2]),
    new Stairs(grid.tiles[4][2]),
]

let player = new Player(new Frame(grid.tiles[2][5], Vector2.half, 0));

function stopHolding() {
    if (player.holding) {
        if (player.holding_side === 1) {
            let otherExtended = player.holding.peg2.tile !== player.holding.tile.adjacent(player.holding.corner);
            let pegTile = player.holding.tile.adjacent(ccwDir(player.holding.corner));
            player.holding.folded = (player.holding.peg1.tile === pegTile) ? (otherExtended ? 1 : 0) : 1;
        } else {
            let otherExtended = player.holding.peg1.tile !== player.holding.tile.adjacent(ccwDir(player.holding.corner));
            let pegTile = player.holding.tile.adjacent(player.holding.corner);
            player.holding.folded = (player.holding.peg2.tile === pegTile) ? (otherExtended ? 1 : 0) : 1;
        }
    }

    player.holding = null;
    player.holding_side = null;
}

// do a single main loop step and request the next step
function step() {
    // start a new frame and clear screen
    Shaku.startFrame();
    Shaku.gfx!.clear(Color.steelblue);

    // EDITOR
    if (CONFIG.editor) {
        let mouse_frame = grid.screen2frame(input.mousePosition)
        if (mouse_frame && Shaku.input.pressed("t")) {
            player.frame.tile = mouse_frame.tile;
        }
        if (Shaku.input.pressed("r")) {
            player.frame.rotccw();
        }
    }

    let input_x = (Shaku.input.down(["d", "right"]) ? 1 : 0) - (Shaku.input.down(["a", "left"]) ? 1 : 0);
    if (input_x === 0) {
        let asdf = .5 - player.frame.pos.x
        if (Math.abs(asdf) > .01) {
            player.frame.move(0, Math.sign(.5 - player.frame.pos.x) * Shaku.gameTime.delta * CONFIG.player_speed
                * ((player.holding === null) ? 1 : .5));
            if (Math.sign(asdf) !== Math.sign(.5 - player.frame.pos.x)) {
                player.frame.pos.x = .5;
            }
        }
    } else {
        let next_frame = player.frame.clone().move(0, Math.sign(input_x) * .4);
        if (next_frame !== null && !next_frame.tile.wall) {
            player.frame.move(0, input_x * Shaku.gameTime.delta * CONFIG.player_speed
                * ((player.holding === null) ? 1 : .5));
        }
    }

    let input_y = (Shaku.input.down(["s", "down"]) ? 1 : 0) - (Shaku.input.down(["w", "up"]) ? 1 : 0);
    if (input_y !== 0 && stairs.some(x => x.tile === player.frame.tile)) {
        // todo: distinguish vertical/horizontal stairs
        let next_frame = player.frame.clone().move(1, Math.sign(input_y) * .3);
        let wall_frame = player.frame.clone().move(1, Math.sign(input_y) * .5);
        if (wall_frame === null || !wall_frame.tile.wall) {
            if (next_frame !== null && !next_frame.tile.wall && stairs.some(x => x.tile === next_frame!.tile)) {
                player.frame.move(1, input_y * Shaku.gameTime.delta * CONFIG.player_speed
                    * ((player.holding === null) ? 1 : .5));
            }
        }
    } else {
        let asdf = .5 - player.frame.pos.y
        if (Math.abs(asdf) > .01) {
            player.frame.move(1, Math.sign(.5 - player.frame.pos.y) * Shaku.gameTime.delta * 2 * CONFIG.player_speed
                * ((player.holding === null) ? 1 : .5));
            if (Math.sign(asdf) !== Math.sign(.5 - player.frame.pos.y)) {
                player.frame.pos.y = .5;
            }
        }
    }

    // Activate gimmicks
    if (player.holding !== null) {
        let originalPeg1Frame = (new Frame(player.holding.tile, Vector2.half, ccwDir(player.holding.corner))).move(0, 1.0)!;
        let originalPeg2Frame = (new Frame(player.holding.tile, Vector2.half, player.holding.corner)).move(0, 1.0)!;

        // TODO: we assume that all ropes are of minimum length
        if (player.holding_side === 1) {
            if (originalPeg2Frame.tile === player.holding.peg2.tile) {
                if (player.frame.tile === originalPeg1Frame.tile) {
                    player.holding.folded = clamp(player.frame.clone().redir(originalPeg1Frame.dir).pos.x - .5, 0, 1);
                } else {
                    // only horizontal direction, todo: expand
                    let next_frame = originalPeg1Frame.clone().move(0, 1.0)!;
                    if (player.frame.tile === next_frame.tile) {
                        // player went forward
                        player.holding.folded = clamp(player.frame.clone().redir(next_frame.dir).pos.x + .5, 0, 1);
                    } else {
                        stopHolding();
                    }
                }
            } else {
                // other string is already tense
                if (player.frame.tile !== originalPeg1Frame.tile) {
                    stopHolding();
                }
            }
        } else {
            if (originalPeg1Frame.tile === player.holding.peg1.tile) {
                if (player.frame.tile === originalPeg2Frame.tile) {
                    player.holding.folded = clamp(player.frame.clone().redir(originalPeg2Frame.dir).pos.x - .5, 0, 1);
                } else {
                    // only horizontal direction, todo: expand
                    let next_frame = originalPeg2Frame.clone().move(0, 1.0)!;
                    if (player.frame.tile === next_frame.tile) {
                        // player went forward
                        player.holding.folded = clamp(player.frame.clone().redir(next_frame.dir).pos.x + .5, 0, 1);
                    } else {
                        stopHolding();
                    }
                }
            } else {
                // other string is already tense
                if (player.frame.tile !== originalPeg2Frame.tile) {
                    stopHolding();
                }
            }
        }

        // autoplace on closest peg
        if (player.holding) {
            let closestPeg = pegs.find(x => x.tile === player.frame.tile);
            if (closestPeg !== undefined && closestPeg !== player.holding.peg1 && !closestPeg.used) {
                // place
                if (player.holding_side === 1) {
                    player.holding.peg1.used = false;
                    player.holding.peg1 = closestPeg;
                    player.holding.peg1.used = true;
                } else {
                    player.holding.peg2.used = false;
                    player.holding.peg2 = closestPeg;
                    player.holding.peg2.used = true;
                }
            }
        }
    }

    if (Shaku.input.pressed("space")) {
        if (player.holding === null) {
            // try to pick
            let peg = pegs.find(x => x.tile === player.frame.tile);
            if (peg !== undefined) {
                let gimmick = gimmicks.find(x => x.peg1 === peg || x.peg2 === peg);
                if (gimmick !== undefined) {
                    player.holding = gimmick;
                    player.holding_side = (gimmick.peg1 === peg) ? 1 : 2;
                }
            }
        } else {
            let peg = pegs.find(x => x.tile === player.frame.tile);
            if (peg !== undefined && !peg.used) {
                // place
                if (player.holding_side === 1) {
                    player.holding.peg1.used = false;
                    player.holding.peg1 = peg;
                    player.holding.peg1.used = true;
                } else {
                    player.holding.peg2.used = false;
                    player.holding.peg2 = peg;
                    player.holding.peg2.used = true;
                }
                stopHolding();
            } else {
                // drop
                stopHolding();
            }
        }
    }

    grid.update(Shaku.gameTime.delta);
    gimmicks.forEach(x => {
        // if (x.folded > 0) {
        grid.almostForceDistanceBetweenCorners(
            x.tile.corner(ccwDir(x.corner)),
            x.tile.corner(cwDir(x.corner)),
            lerp(Math.SQRT2, .05, x.folded) * CONFIG.tile_size,
        )
        grid.almostForceDistanceBetweenCorners(
            x.tile.corner(x.corner),
            x.tile.corner(cwDir(cwDir(x.corner))),
            lerp(Math.SQRT2, 1.95, x.folded) * CONFIG.tile_size,
        )
        // }
    });
    grid.draw();
    stairs.forEach(x => x.draw());
    pegs.forEach(x => x.draw());
    gimmicks.forEach(x => x.draw());
    player.draw();

    // end frame and request next step
    Shaku.endFrame();
    Shaku.requestAnimationFrame(step);
}

function makeRectArray<T>(width: number, height: number, fill: T): T[][] {
    let result: T[][] = [];
    for (let j = 0; j < height; j++) {
        let cur_row: T[] = [];
        for (let i = 0; i < width; i++) {
            cur_row.push(fill);
        }
        result.push(cur_row);
    }
    return result;
}

function makeRectArrayFromFunction<T>(width: number, height: number, fill: (i: number, j: number) => T): T[][] {
    let result: T[][] = [];
    for (let j = 0; j < height; j++) {
        let cur_row: T[] = [];
        for (let i = 0; i < width; i++) {
            cur_row.push(fill(i, j));
        }
        result.push(cur_row);
    }
    return result;
}

function forEachTile<T>(map: T[][], func: (tile: T, i: number, j: number) => void) {
    for (let j = 0; j < map.length; j++) {
        let cur_row = map[j];
        for (let i = 0; i < map[0].length; i++) {
            func(cur_row[i], i, j);
        }
    }
}

function clamp(value: number, a: number, b: number) {
    if (value < a) return a;
    if (value > b) return b;
    return value;
}

function moveTowards(cur_val: number, target_val: number, max_delta: number): number {
    if (target_val > cur_val) {
        return Math.min(cur_val + max_delta, target_val);
    } else if (target_val < cur_val) {
        return Math.max(cur_val - max_delta, target_val);
    } else {
        return target_val;
    }
}

function moveTowardsV(cur_val: Vector2, target_val: Vector2, max_dist: number): Vector2 {
    let delta = target_val.sub(cur_val);
    let dist = delta.length;
    if (dist < max_dist) {
        // already arrived
        return target_val.clone();
    }
    delta.mulSelf(max_dist / dist);
    return cur_val.add(delta);
}

// test loading screen
// await new Promise(r => setTimeout(r, 2000));

// document.getElementById("loading")!.style.opacity = "0";

// start main loop
step();