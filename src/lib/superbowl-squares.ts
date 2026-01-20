export type TeamScore = {
  home: number;
  away: number;
};

export type GridNumbers = {
  /** 10 unique digits 0-9 assigned to the home team axis */
  homeAxis: number[];
  /** 10 unique digits 0-9 assigned to the away team axis */
  awayAxis: number[];
};

export type SquareCoordinate = {
  homeDigit: number;
  awayDigit: number;
};

export const SUPER_BOWL_SQUARES = {
  GRID_SIZE: 10,
  TOTAL_SQUARES: 100,
} as const;

export function isValidDigit(digit: number): boolean {
  return Number.isInteger(digit) && digit >= 0 && digit <= 9;
}

export function validateAxis(axis: number[]): void {
  if (axis.length !== 10) {
    throw new Error('Axis must contain exactly 10 digits.');
  }
  for (const d of axis) {
    if (!isValidDigit(d)) {
      throw new Error('Axis digits must be integers 0-9.');
    }
  }
  const unique = new Set(axis);
  if (unique.size !== 10) {
    throw new Error('Axis digits must be unique (0-9).');
  }
}

/**
 * Given the final digits of each team score, compute the winning square coordinate.
 */
export function getWinningSquare(score: TeamScore): SquareCoordinate {
  const homeDigit = Math.abs(score.home) % 10;
  const awayDigit = Math.abs(score.away) % 10;
  return { homeDigit, awayDigit };
}

/**
 * Translate the winning digits into a grid row/col index based on assigned axis numbers.
 *
 * Example:
 * - homeAxis = [3,8,1,0,5,2,9,6,4,7]
 * - if homeDigit is 7, homeIndex is 9
 */
export function getWinningIndexes(numbers: GridNumbers, score: TeamScore): { homeIndex: number; awayIndex: number } {
  validateAxis(numbers.homeAxis);
  validateAxis(numbers.awayAxis);

  const { homeDigit, awayDigit } = getWinningSquare(score);

  const homeIndex = numbers.homeAxis.indexOf(homeDigit);
  const awayIndex = numbers.awayAxis.indexOf(awayDigit);

  if (homeIndex === -1 || awayIndex === -1) {
    throw new Error('Assigned axis numbers must contain digits 0-9.');
  }

  return { homeIndex, awayIndex };
}

/**
 * Determine if purchasing squares should be allowed.
 * When `gameStartsAt` is reached (or passed), purchases are locked.
 */
export function canPurchaseSquares(opts: { now?: Date; gameStartsAt: Date }): boolean {
  const now = opts.now ?? new Date();
  return now.getTime() < opts.gameStartsAt.getTime();
}
