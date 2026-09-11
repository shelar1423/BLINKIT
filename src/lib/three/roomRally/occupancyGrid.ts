import * as THREE from 'three';

export enum CellType {
  FREE = 0,
  BLOCKED = 1,
  DILATED = 2,
  EDGE_UNSAFE = 3,
  UNKNOWN = 4,
}

export type GridPoint = {
  x: number;
  z: number;
};

export type OccupancyGridConfig = {
  cellSize?: number; // Metres per cell (e.g. 0.05m = 5cm)
  extentX?: number; // Total width in metres (e.g. 3.0m)
  extentZ?: number; // Total depth in metres (e.g. 3.0m)
  carWidth?: number; // Metres (~0.05m)
  carLength?: number; // Metres (~0.09m)
  safetyMargin?: number; // Metres (~0.02m)
};

export class OccupancyGrid {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  readonly originX: number;
  readonly originZ: number;
  readonly cells: Uint8Array;

  readonly carWidth: number;
  readonly carLength: number;
  readonly clearanceCells: number;

  constructor(config: OccupancyGridConfig = {}) {
    this.cellSize = config.cellSize ?? 0.05;
    const extentX = config.extentX ?? 3.0;
    const extentZ = config.extentZ ?? 3.0;

    this.cols = Math.ceil(extentX / this.cellSize);
    this.rows = Math.ceil(extentZ / this.cellSize);
    this.originX = -((this.cols * this.cellSize) / 2);
    this.originZ = -((this.rows * this.cellSize) / 2);

    this.cells = new Uint8Array(this.cols * this.rows);
    this.cells.fill(CellType.FREE);

    this.carWidth = config.carWidth ?? 0.05;
    this.carLength = config.carLength ?? 0.09;
    const safety = config.safetyMargin ?? 0.02;
    const clearanceRadius = this.carWidth / 2 + safety;
    this.clearanceCells = Math.max(1, Math.ceil(clearanceRadius / this.cellSize));
  }

  reset() {
    this.cells.fill(CellType.FREE);
  }

  worldToGrid(wx: number, wz: number): { col: number; row: number } | null {
    const col = Math.floor((wx - this.originX) / this.cellSize);
    const row = Math.floor((wz - this.originZ) / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
    return { col, row };
  }

  gridToWorld(col: number, row: number): GridPoint {
    return {
      x: this.originX + (col + 0.5) * this.cellSize,
      z: this.originZ + (row + 0.5) * this.cellSize,
    };
  }

  getIndex(col: number, row: number): number {
    return row * this.cols + col;
  }

  getCell(col: number, row: number): CellType {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return CellType.EDGE_UNSAFE;
    }
    return this.cells[this.getIndex(col, row)] as CellType;
  }

  setCell(col: number, row: number, type: CellType) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    this.cells[this.getIndex(col, row)] = type;
  }

  /** Mark cells outside the detected surface polygon as EDGE_UNSAFE */
  applyPlaneBoundary(polygonVertices: THREE.Vector3[], planeTransform?: THREE.Matrix4) {
    if (polygonVertices.length < 3) return;

    // Transform polygon to grid space
    const pts = polygonVertices.map((v) => {
      const p = v.clone();
      if (planeTransform) p.applyMatrix4(planeTransform);
      return { x: p.x, z: p.z };
    });

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const wp = this.gridToWorld(c, r);
        if (!this.pointInPolygon(wp.x, wp.z, pts)) {
          this.setCell(c, r, CellType.EDGE_UNSAFE);
        }
      }
    }
  }

  private pointInPolygon(x: number, z: number, poly: { x: number; z: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].z;
      const xj = poly[j].x, zj = poly[j].z;
      const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Mark mesh vertices/triangles as obstacles.
   * Obstacles are real-world points with height between minHeight and maxHeight above surface.
   */
  markObstaclesFromGeometry(
    positions: Float32Array,
    indices: Uint32Array | Uint16Array | null,
    transform: THREE.Matrix4,
    surfaceY = 0,
    minHeight = 0.015, // 1.5 cm above table
    maxHeight = 0.50, // 50 cm high max (bottles, laptops, walls)
  ) {
    const v = new THREE.Vector3();
    const count = indices ? indices.length : positions.length / 3;

    for (let i = 0; i < count; i += 3) {
      const idx = indices ? indices[i] : i;
      v.set(positions[idx * 3], positions[idx * 3 + 1], positions[idx * 3 + 2]);
      v.applyMatrix4(transform);

      const relY = v.y - surfaceY;
      if (relY >= minHeight && relY <= maxHeight) {
        const g = this.worldToGrid(v.x, v.z);
        if (g && this.getCell(g.col, g.row) !== CellType.EDGE_UNSAFE) {
          this.setCell(g.col, g.row, CellType.BLOCKED);
        }
      }
    }
  }

  /**
   * Obstacle Dilation:
   * Expands blocked cells by the car's clearance radius so narrow gaps
   * (< car width) become untraversable!
   */
  dilateObstacles() {
    const copy = new Uint8Array(this.cells);
    const radius = this.clearanceCells;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        if (copy[idx] === CellType.BLOCKED || copy[idx] === CellType.EDGE_UNSAFE) {
          for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
              if (dr * dr + dc * dc <= radius * radius) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols) {
                  const targetIdx = nr * this.cols + nc;
                  if (this.cells[targetIdx] === CellType.FREE) {
                    this.cells[targetIdx] = CellType.DILATED;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  /** Check if a world coordinate is free and safe for the car */
  isTraversable(wx: number, wz: number): boolean {
    const g = this.worldToGrid(wx, wz);
    if (!g) return false;
    const type = this.getCell(g.col, g.row);
    return type === CellType.FREE;
  }

  /**
   * A* Pathfinding:
   * Validates if a traversable path exists between start and finish.
   * Only cells of type FREE are traversable (DILATED and BLOCKED are avoided).
   */
  findPath(startW: GridPoint, finishW: GridPoint): { path: GridPoint[]; reachable: boolean } {
    const startG = this.worldToGrid(startW.x, startW.z);
    const finishG = this.worldToGrid(finishW.x, finishW.z);

    if (!startG || !finishG) {
      return { path: [], reachable: false };
    }

    // If start or finish is inside a dilated cell, find nearest free cell
    const safeStart = this.findNearestFreeCell(startG.col, startG.row);
    const safeFinish = this.findNearestFreeCell(finishG.col, finishG.row);

    if (!safeStart || !safeFinish) {
      return { path: [], reachable: false };
    }

    const cols = this.cols;
    const rows = this.rows;
    const totalCells = cols * rows;

    const gScore = new Float32Array(totalCells).fill(Infinity);
    const fScore = new Float32Array(totalCells).fill(Infinity);
    const cameFrom = new Int32Array(totalCells).fill(-1);
    const inOpen = new Uint8Array(totalCells);

    const startIdx = safeStart.row * cols + safeStart.col;
    const finishIdx = safeFinish.row * cols + safeFinish.col;

    gScore[startIdx] = 0;
    fScore[startIdx] = this.heuristic(safeStart.col, safeStart.row, safeFinish.col, safeFinish.row);

    const openList: number[] = [startIdx];
    inOpen[startIdx] = 1;

    const neighbors = [
      { dc: 1, dr: 0, cost: 1 },
      { dc: -1, dr: 0, cost: 1 },
      { dc: 0, dr: 1, cost: 1 },
      { dc: 0, dr: -1, cost: 1 },
      { dc: 1, dr: 1, cost: 1.414 },
      { dc: -1, dr: 1, cost: 1.414 },
      { dc: 1, dr: -1, cost: 1.414 },
      { dc: -1, dr: -1, cost: 1.414 },
    ];

    while (openList.length > 0) {
      // Find lowest fScore in open list
      let lowestIndex = 0;
      for (let i = 1; i < openList.length; i++) {
        if (fScore[openList[i]] < fScore[openList[lowestIndex]]) {
          lowestIndex = i;
        }
      }

      const current = openList[lowestIndex];
      if (current === finishIdx) {
        // Reconstruct path
        const path: GridPoint[] = [];
        let curr = current;
        while (curr !== -1) {
          const c = curr % cols;
          const r = Math.floor(curr / cols);
          path.push(this.gridToWorld(c, r));
          curr = cameFrom[curr];
        }
        path.reverse();
        return { path, reachable: true };
      }

      // Remove current from open list
      openList.splice(lowestIndex, 1);
      inOpen[current] = 0;

      const c = current % cols;
      const r = Math.floor(current / cols);

      for (const { dc, dr, cost } of neighbors) {
        const nc = c + dc;
        const nr = r + dr;

        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
        const nIdx = nr * cols + nc;

        // Untraversable cells: BLOCKED, EDGE_UNSAFE, DILATED
        const nType = this.cells[nIdx];
        if (nType !== CellType.FREE) continue;

        const tentativeG = gScore[current] + cost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = current;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] = tentativeG + this.heuristic(nc, nr, safeFinish.col, safeFinish.row);

          if (!inOpen[nIdx]) {
            openList.push(nIdx);
            inOpen[nIdx] = 1;
          }
        }
      }
    }

    return { path: [], reachable: false };
  }

  private heuristic(c1: number, r1: number, c2: number, r2: number): number {
    const dc = Math.abs(c1 - c2);
    const dr = Math.abs(r1 - r2);
    return Math.sqrt(dc * dc + dr * dr);
  }

  findNearestFreeCell(col: number, row: number, maxRadius = 12): { col: number; row: number } | null {
    if (this.getCell(col, row) === CellType.FREE) return { col, row };

    for (let r = 1; r <= maxRadius; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) === r || Math.abs(dr) === r) {
            const nc = col + dc;
            const nr = row + dr;
            if (this.getCell(nc, nr) === CellType.FREE) {
              return { col: nc, row: nr };
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * Get all traversable FREE cells connected to start point via flood fill.
   * Used for guaranteed reachable grocery spawning!
   */
  getReachableFreeCells(startW: GridPoint): GridPoint[] {
    const startG = this.worldToGrid(startW.x, startW.z);
    if (!startG) return [];

    const safeStart = this.findNearestFreeCell(startG.col, startG.row);
    if (!safeStart) return [];

    const cols = this.cols;
    const rows = this.rows;
    const visited = new Uint8Array(cols * rows);
    const queue: { col: number; row: number }[] = [safeStart];
    const startIdx = safeStart.row * cols + safeStart.col;
    visited[startIdx] = 1;

    const reachable: GridPoint[] = [];

    const dirs = [
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 0, dr: -1 },
    ];

    while (queue.length > 0) {
      const { col, row } = queue.shift()!;
      reachable.push(this.gridToWorld(col, row));

      for (const { dc, dr } of dirs) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
          const idx = nr * cols + nc;
          if (!visited[idx] && this.cells[idx] === CellType.FREE) {
            visited[idx] = 1;
            queue.push({ col: nc, row: nr });
          }
        }
      }
    }

    return reachable;
  }
}
