export type CellType =
  | 'go'
  | 'property'
  | 'railroad'
  | 'utility'
  | 'tax'
  | 'chance'
  | 'community_chest'
  | 'jail'
  | 'free_parking'
  | 'go_to_jail';

export type ColorGroup =
  | 'brown'
  | 'lightBlue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green'
  | 'darkBlue';

export interface Cell {
  index: number;
  name: string;
  type: CellType;
  colorGroup?: ColorGroup;
  price?: number;
  baseRent?: number;
  /** Rent schedule: [base, 1house, 2houses, 3houses, 4houses, hotel] */
  rents?: number[];
  /** Cost to build one house on this property */
  houseCost?: number;
}

// House costs per color group
export const HOUSE_COST: Record<ColorGroup, number> = {
  brown: 50,
  lightBlue: 50,
  pink: 100,
  orange: 100,
  red: 150,
  yellow: 150,
  green: 200,
  darkBlue: 200,
};

export const BOARD: Cell[] = [
  { index: 0, name: 'GO', type: 'go' },
  { index: 1, name: 'Mediterranean Avenue', type: 'property', colorGroup: 'brown', price: 60, baseRent: 2, rents: [2, 10, 30, 90, 160, 250], houseCost: 50 },
  { index: 2, name: 'Community Chest', type: 'community_chest' },
  { index: 3, name: 'Baltic Avenue', type: 'property', colorGroup: 'brown', price: 60, baseRent: 4, rents: [4, 20, 60, 180, 320, 450], houseCost: 50 },
  { index: 4, name: 'Income Tax', type: 'tax', price: 200 },
  { index: 5, name: 'Reading Railroad', type: 'railroad', price: 200, baseRent: 25 },
  { index: 6, name: 'Oriental Avenue', type: 'property', colorGroup: 'lightBlue', price: 100, baseRent: 6, rents: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { index: 7, name: 'Chance', type: 'chance' },
  { index: 8, name: 'Vermont Avenue', type: 'property', colorGroup: 'lightBlue', price: 100, baseRent: 6, rents: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { index: 9, name: 'Connecticut Avenue', type: 'property', colorGroup: 'lightBlue', price: 120, baseRent: 8, rents: [8, 40, 100, 300, 450, 600], houseCost: 50 },
  { index: 10, name: 'Jail / Just Visiting', type: 'jail' },
  { index: 11, name: 'St. Charles Place', type: 'property', colorGroup: 'pink', price: 140, baseRent: 10, rents: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { index: 12, name: 'Electric Company', type: 'utility', price: 150, baseRent: 0 },
  { index: 13, name: 'States Avenue', type: 'property', colorGroup: 'pink', price: 140, baseRent: 10, rents: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { index: 14, name: 'Virginia Avenue', type: 'property', colorGroup: 'pink', price: 160, baseRent: 12, rents: [12, 60, 180, 500, 700, 900], houseCost: 100 },
  { index: 15, name: 'Pennsylvania Railroad', type: 'railroad', price: 200, baseRent: 25 },
  { index: 16, name: 'St. James Place', type: 'property', colorGroup: 'orange', price: 180, baseRent: 14, rents: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { index: 17, name: 'Community Chest', type: 'community_chest' },
  { index: 18, name: 'Tennessee Avenue', type: 'property', colorGroup: 'orange', price: 180, baseRent: 14, rents: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { index: 19, name: 'New York Avenue', type: 'property', colorGroup: 'orange', price: 200, baseRent: 16, rents: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
  { index: 20, name: 'Free Parking', type: 'free_parking' },
  { index: 21, name: 'Kentucky Avenue', type: 'property', colorGroup: 'red', price: 220, baseRent: 18, rents: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { index: 22, name: 'Chance', type: 'chance' },
  { index: 23, name: 'Indiana Avenue', type: 'property', colorGroup: 'red', price: 220, baseRent: 18, rents: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { index: 24, name: 'Illinois Avenue', type: 'property', colorGroup: 'red', price: 240, baseRent: 20, rents: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
  { index: 25, name: 'B. & O. Railroad', type: 'railroad', price: 200, baseRent: 25 },
  { index: 26, name: 'Atlantic Avenue', type: 'property', colorGroup: 'yellow', price: 260, baseRent: 22, rents: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { index: 27, name: 'Ventnor Avenue', type: 'property', colorGroup: 'yellow', price: 260, baseRent: 22, rents: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { index: 28, name: 'Water Works', type: 'utility', price: 150, baseRent: 0 },
  { index: 29, name: 'Marvin Gardens', type: 'property', colorGroup: 'yellow', price: 280, baseRent: 24, rents: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
  { index: 30, name: 'Go To Jail', type: 'go_to_jail' },
  { index: 31, name: 'Pacific Avenue', type: 'property', colorGroup: 'green', price: 300, baseRent: 26, rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { index: 32, name: 'North Carolina Avenue', type: 'property', colorGroup: 'green', price: 300, baseRent: 26, rents: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { index: 33, name: 'Community Chest', type: 'community_chest' },
  { index: 34, name: 'Pennsylvania Avenue', type: 'property', colorGroup: 'green', price: 320, baseRent: 28, rents: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
  { index: 35, name: 'Short Line Railroad', type: 'railroad', price: 200, baseRent: 25 },
  { index: 36, name: 'Chance', type: 'chance' },
  { index: 37, name: 'Park Place', type: 'property', colorGroup: 'darkBlue', price: 350, baseRent: 35, rents: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
  { index: 38, name: 'Luxury Tax', type: 'tax', price: 100 },
  { index: 39, name: 'Boardwalk', type: 'property', colorGroup: 'darkBlue', price: 400, baseRent: 50, rents: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 },
];

export const COLOR_GROUP_SIZES: Record<ColorGroup, number> = {
  brown: 2,
  lightBlue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  darkBlue: 2,
};

export const GO_SALARY = 200;
export const JAIL_FINE = 50;
export const MAX_JAIL_TURNS = 3;
export const STARTING_MONEY = 1500;
export const BOARD_SIZE = 40;
export const JAIL_POSITION = 10;
export const MAX_HOUSES = 5; // 5 = hotel
