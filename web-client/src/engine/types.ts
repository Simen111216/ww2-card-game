export enum Faction {
  SOVIET = 'Soviet',
  USA = 'USA',
  UK = 'UK',
  FRANCE = 'France',
  GERMANY = 'Germany'
}

export enum UnitCategory {
  INFANTRY = '步兵',
  ARMOR = '装甲',
  ARTILLERY = '炮兵',
  AIR_FORCE = '空军'
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
  isAdvanced?: boolean; // 是否为高级卡牌（需通过军校解锁）
}

// 词条系统
export enum Keyword {
  BLITZ = '闪击', // 闪击: 部署当回合即可攻击
  GUARD = '守护', // 守护: 必须先攻击具有守护的单位
  AMBUSH = '伏击', // 伏击: 造成伤害前先结算，如果秒杀则自身不受反击（暂时保留设定）
  HEAVY_ARMOR = '重甲', // 重甲: 受到的所有伤害-1
  ANTI_AIR = '防空' // 防空: 对空军造成额外伤害
}

export interface UnitCard extends BaseCard {
  type: CardType.UNIT;
  category: UnitCategory; // 兵种分类
  attack: number;     // 攻击力 (1-15)
  defense: number;    // 防御力 (1-15)
  hp: number;         // 血量 (1-20)
  maxHp: number;
  moveCost: number;   // 移动消耗指挥点 (1-6)
  keywords: Keyword[];
  hasMovedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  line: 'support' | 'frontline'; // 所处战线
}

export interface OrderCard extends BaseCard {
  type: CardType.ORDER;
  // 指令卡的作用后续通过效果引擎来实现
  effect: (game: any, target?: any) => void; 
}

export interface Commander {
  id: string;
  name: string;
  faction: Faction;
  avatar?: string;
  passiveName: string;
  passiveDesc: string;
  activeName: string;
  activeDesc: string;
  activeCost: number;
  activeCooldown: number;
  currentCooldown?: number;
  useActive: (game: any, player: any) => void;
  onTurnStart?: (game: any, player: any) => void;
}

export interface EnvironmentCard extends BaseCard {
  type: CardType.ENVIRONMENT;
  onPlay: (game: any) => void; // 替换环境时的即时效果
  onTurnStart?: (game: any) => void; // 每回合持续效果
}

export interface HQCard extends BaseCard {
  type: CardType.HQ;
  hp: number; // 初始为25
  maxHp: number;
}
