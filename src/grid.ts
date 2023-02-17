
import Shaku from "shaku/lib/shaku";
import Sprite from "shaku/lib/gfx/sprite";
import Color from "shaku/lib/utils/color";
import Vector2 from "shaku/lib/utils/vector2";

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

function localPos(pos: Vector2): boolean {
    return pos.x >= 0 && pos.x < 1 && pos.y >= 0 && pos.y < 1;
}

const RESOLUTION = 3;
const TILE_SIZE = 80 * Shaku.gfx.canvas.width / 600;
// const OFFSET = new Vector2(-TILE_SIZE / 4, -TILE_SIZE / 4);
// OFFSET + TILE_SIZE * 4 = screen center
// OFFSET = width / 2 - TILE_SIZE * 4
const OFFSET = new Vector2((Shaku.gfx.canvas.width / 2) - TILE_SIZE * 4, (Shaku.gfx.canvas.height / 2) - TILE_SIZE * 4.25);

frame_sprite.size.mulSelf(TILE_SIZE / 80);
bar_sprite.size.mulSelf(TILE_SIZE / 80);
knob_sprite.size.mulSelf(1.25 * TILE_SIZE / 80);

/** between -1 & 1, the grid's deformation; 1 means (3,2) goes to (4,3) */
let THINGY = 0;

/** Special tile */
let SI = 4;
let SJ = 4;

/** Spatial game data */
class Grid {
    // todo: change this for general grids
    public tiles: Tile[][];
    public corners: Corner[][];
    constructor(
        public w: number,
        public h: number,
    ) {
        this.corners = makeRectArrayFromFunction<Corner>(w + 1, h + 1, (i, j) => {
            return new Corner(
                i, j,
                OFFSET.add(i * TILE_SIZE, j * TILE_SIZE),
                i == 0 || j == 0 || i == w || j == h
            )
        });
        this.tiles = makeRectArrayFromFunction<Tile>(w, h, (i, j) => new Tile(i, j, i === 0 || i === w - 1 || j === 0 || j === h - 1));
    }

    draw() {
        /*for (let i = 0; i <= this.w; i++) {
            Shaku.gfx.drawLine(OFFSET.add(i * TILE_SIZE, 0), OFFSET.add(i * TILE_SIZE, this.h * TILE_SIZE), Color.black);
        }
        for (let j = 0; j <= this.h; j++) {
            Shaku.gfx.drawLine(OFFSET.add(0, j * TILE_SIZE), OFFSET.add(this.w * TILE_SIZE, j * TILE_SIZE), Color.black);
        }*/

        /*for (let j = 0; j < this.h; j++) {
            for (let i = 0; i < this.w; i++) {
                let tile = this.tiles[j][i];
                gfx.drawLinesStrip([
                    this.frame2screen(new Frame(tile, Vector2.zero, 0)),
                    this.frame2screen(new Frame(tile, Vector2.right, 0)),
                    this.frame2screen(new Frame(tile, Vector2.one, 0)),
                    this.frame2screen(new Frame(tile, Vector2.down, 0)),
                    this.frame2screen(new Frame(tile, Vector2.zero, 0)),
                ], Color.black);
            }
        }*/

        for (let j = 1; j < this.h - 1; j++) {
            for (let i = 1; i < this.w - 1; i++) {
                this.tiles[j][i].drawBackground();
            }
        }
        this.tiles[3][7].drawBackground();
    }

    update(dt: number) {
        dt = clamp(dt, 0, .01);
        //for (let k = 0; k < CONFIG.physics_accuracy; k++) {
        // for each non-border corner...
        for (let j = 2; j < this.h - 1; j++) {
            for (let i = 2; i < this.w - 1; i++) {
                let corner = this.corners[j][i];
                // move to connected corners
                for (let d = 0; d < 4; d++) {
                    let other = this.corners[j + DJ[d as direction]][i + DI[d as direction]];
                    corner.force.addSelf(other.pos.sub(corner.pos).mul(CONFIG.force * ((1 - .5 * Math.abs(THINGY)))));
                    // corner.pos.addSelf(other.pos.sub(corner.pos).mul(dt * CONFIG.force));
                    // this.forceDistanceBetweenCorners(corner, other, TILE_SIZE);
                }
            }
        }

        for (let j = 1; j < this.h; j++) {
            for (let i = 1; i < this.w; i++) {
                let corner = this.corners[j][i];
                corner.update(dt);
            }
        }

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

        for (let j = 1; j < this.h - 1; j++) {
            for (let i = 1; i < this.w - 1; i++) {
                this.tiles[j][i].updateSprites();
            }
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
        // todo: change this for general grids
        /*let pos = screen_pos.sub(OFFSET).divSelf(TILE_SIZE);
        let i = Math.floor(pos.x);
        let j = Math.floor(pos.y);
        if (i < 0 || i >= this.w || j < 0 || j >= this.h) return null;
        return new Frame(this.tiles[j][i], new Vector2(pos.x % 1, pos.y % 1), 0);*/
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
        public i: number, // todo: change this for general grids
        public j: number, // todo: change this for general grids
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
    // private sprite: Sprite;
    public sprites: Sprite[][];
    public verts: Vector2[][];
    constructor(
        public i: number, // todo: change this for general grids
        public j: number, // todo: change this for general grids
        // Game logic
        public wall: boolean,
        public car: Car | null = null,
    ) {
        this.verts = makeRectArrayFromFunction<Vector2>(RESOLUTION + 1, RESOLUTION + 1, (i, j) => {
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
        });
    }

    adjacent(dir: direction): Tile | null {
        // todo: change this for general grids
        let ni = this.i + DI[dir];
        let nj = this.j + DJ[dir];
        if (ni < 0 || ni >= grid.w || nj < 0 || nj >= grid.h) return null;

        if (ni === SI && nj === SJ) {
            if (THINGY > .5) {
                switch (this.i) {
                    case SI - 1:
                        nj += 1;
                        break;
                    case SI + 1:
                        nj -= 1;
                        break;
                    case SI:
                        ni += (this.j < SJ) ? 1 : -1;
                        break;
                    default:
                        throw new Error("bad grid");
                }
            } else if (THINGY < -.5) {
                switch (this.i) {
                    case SI - 1:
                        nj -= 1;
                        break;
                    case SI + 1:
                        nj += 1;
                        break;
                    case SI:
                        ni += (this.j < SJ) ? -1 : 1;
                        break;
                    default:
                        throw new Error("bad grid");
                }
            }
        }

        return grid.tiles[nj][ni];
    }

    corner(dir: direction): Corner {
        // todo: change this for general grids
        let ni = this.i + DI_CORNER[dir];
        let nj = this.j + DJ_CORNER[dir];
        return grid.corners[nj][ni];
    }

    updateSprites() {
        let temp_frame = new Frame(this, Vector2.zero, 0);
        for (let j = 0; j <= RESOLUTION; j++) {
            for (let i = 0; i <= RESOLUTION; i++) {
                temp_frame.pos.set(i / RESOLUTION, j / RESOLUTION);
                this.verts[j][i].copy(grid.frame2screen(temp_frame))
            }
        }


        /*this.sprite._cachedVertices = [
            // @ts-ignore
            new Vertex(this.corner(1).pos, Vector2.zero), // topLeft
            // @ts-ignore
            new Vertex(this.corner(0).pos), // topRight
            // @ts-ignore
            new Vertex(this.corner(2).pos), // bottomLeft
            // @ts-ignore
            new Vertex(this.corner(3).pos, Vector2.one), // bottomRight
        ]*/
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
    }

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
        if (dist < 0) {
            return this.move(oppDir(dir), -dist);
        }
        if (dist == 0) return this;
        if (dist > 1) {
            return this.move(dir, 1)?.move(dir, dist - 1) || null;
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
            if (!localPos(this.pos)) {
                // console.log("implementation error in Frame.move, this should be a local pos: ", this.pos.x, this.pos.y);
                // throw new Error("implementation error in Frame.move");
            }

            // going back should bring us back; if not, correct direction
            while (new_tile.adjacent(rotateDir(oppDir(dir), this.dir)) !== this.tile) {
                this.dir = rotateDir(this.dir, 1);
            }
            /*for (var i = 0; i < 4; i++) {
                if (this.tile == new_tile.adjacent[((4 + i + 2 + ind - this.dir) % 4)]) {
                    this.dir = i % 4 as direction;
                    break;
                }
            }*/
            this.tile = new_tile;
            /*while (this.tile.adjacent(rotateDir(this.dir, 2)) {

            }*/

            return this;
        }
    }

    clone() {
        return new Frame(this.tile, this.pos.clone(), this.dir);
    }
}
