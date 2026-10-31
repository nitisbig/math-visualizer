// Loss functions for the gradient descent widgets, with analytic gradients.

export type Fn1 = {
  label: string;
  f: (x: number) => number;
  df: (x: number) => number;
  /** Visible y range. */
  y: [number, number];
  minima: number[];
  start: number;
};

export const FN1 = {
  bowl: {
    label: "Bowl",
    f: (x) => 0.5 * x * x,
    df: (x) => x,
    y: [-0.6, 4.8],
    minima: [0],
    start: 2.6,
  },
  valleys: {
    label: "Two valleys",
    f: (x) => 0.25 * x ** 4 - x * x + 0.3 * x,
    df: (x) => x ** 3 - 2 * x + 0.3,
    y: [-2, 5],
    minima: [-1.484, 1.3322],
    start: 2.4,
  },
} satisfies Record<string, Fn1>;

export type Fn1Id = keyof typeof FN1;
export const FN1_IDS = Object.keys(FN1) as Fn1Id[];

export type Vec2 = [number, number];

export type Fn2 = {
  label: string;
  f: (x: number, y: number) => number;
  grad: (x: number, y: number) => Vec2;
  domain: { x: [number, number]; y: [number, number] };
  minima: Vec2[];
  start: Vec2;
  /** A learning rate that behaves well on this surface. */
  lr: number;
  /** Shade with log(1 + f) so steep surfaces still show their floor. */
  logShade?: boolean;
};

// Two Gaussian wells on a gentle bowl: a deep global minimum and a shallow local one.
const W1 = { x: -1.2, y: -0.6, d: 1.2, s: 0.8 };
const W2 = { x: 1.3, y: 0.9, d: 0.8, s: 0.6 };
const well = (w: typeof W1, x: number, y: number) =>
  w.d * Math.exp(-((x - w.x) ** 2 + (y - w.y) ** 2) / w.s);

export const FN2 = {
  bowl: {
    label: "Bowl",
    f: (x, y) => 0.5 * (x * x + y * y),
    grad: (x, y) => [x, y],
    domain: { x: [-3, 3], y: [-3, 3] },
    minima: [[0, 0]],
    start: [-2.4, 2.1],
    lr: 0.15,
  },
  valley: {
    label: "Narrow valley",
    f: (x, y) => 0.1 * x * x + 2 * y * y,
    grad: (x, y) => [0.2 * x, 4 * y],
    domain: { x: [-3, 3], y: [-3, 3] },
    minima: [[0, 0]],
    start: [-2.6, 1.4],
    lr: 0.45,
  },
  wells: {
    label: "Two minima",
    f: (x, y) => 1 - well(W1, x, y) - well(W2, x, y) + 0.05 * (x * x + y * y),
    grad: (x, y) => {
      const a = well(W1, x, y);
      const b = well(W2, x, y);
      return [
        (2 * a * (x - W1.x)) / W1.s + (2 * b * (x - W2.x)) / W2.s + 0.1 * x,
        (2 * a * (y - W1.y)) / W1.s + (2 * b * (y - W2.y)) / W2.s + 0.1 * y,
      ];
    },
    domain: { x: [-3, 3], y: [-3, 3] },
    minima: [
      [-1.15, -0.57],
      [1.24, 0.86],
    ],
    start: [2.6, 2.4],
    lr: 0.3,
  },
  rosenbrock: {
    label: "Rosenbrock",
    f: (x, y) => (1 - x) ** 2 + 20 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 80 * x * (y - x * x), 40 * (y - x * x)],
    domain: { x: [-2, 2], y: [-1, 3] },
    minima: [[1, 1]],
    start: [-1.6, 2.6],
    lr: 0.008,
    logShade: true,
  },
} satisfies Record<string, Fn2>;

export type Fn2Id = keyof typeof FN2;
export const FN2_IDS = Object.keys(FN2) as Fn2Id[];
