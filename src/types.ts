export enum Faction {
  SOVIET = 'Soviet',
  USA = 'USA',
  UK = 'UK',
  FRANCE = 'France',
  GERMANY = 'Germany'
}

export enum CardType {
  UNIT = 'Unit',
  ORDER = 'Order',
  ENVIRONMENT = 'Environment',
  HQ = 'HQ'
}

export interface BaseCard {
  id: string;
  name: string;
  description: string;
  type: CardType;
  faction: Faction;
  deployCost: number; // 部署消耗的指挥点 (1-15)
}

// 词条系统
export enum Keyword {
  BLITZ = 'Blitz', // 闪击
  GUARD = 'Guard', // 守护
  AMBUSH = 'Ambush' // 伏击
  // 可根据后续需求添加
}

export interface UnitCard extends BaseCard {
  type: CardType.UNIT;
  attack: number;     // 攻击力 (1-15)
  defense: number;    // 防御力 (1-15)
  hp: number;         // 血量 (1-20)
  maxHp: number;
  moveCost: number;   // 移动消耗指挥点 (1-6)
  keywords: Keyword[];
  hasMovedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
}

export interface OrderCard extends BaseCard {
  type: CardType.ORDER;
  // 指令卡的作用后续通过效果引擎来实现
  effect: (game: any, target?: any) => void; 
}

export interface EnvironmentCard extends BaseCard {
  type: CardType.ENVIRONMENT;
  effect: (game: any) => void;
}

export interface HQCard extends BaseCard {
  type: CardType.HQ;
  hp: number; // 初始为25
  maxHp: number;
}
