import { useState, useEffect, useRef } from 'react';
import { Game } from './engine/Game';
import { Player } from './engine/Player';
import { Faction, CardType, UnitCategory, Keyword } from './engine/types';
import type { UnitCard, OrderCard, BaseCard } from './engine/types';
import { CardComponent } from './components/CardComponent';
import { Academy } from './components/Academy';
import { motion, AnimatePresence } from 'framer-motion';
import { networkManager, type NetworkAction } from './engine/NetworkManager';
import './index.css';

// --- 真实历史单位库 ---
function getSovietUnits(): any[] {
  return [
    { name: '动员兵', cat: UnitCategory.INFANTRY, cost: 1, atk: 2, def: 1, hp: 3, desc: '数量庞大的基础步兵，装备莫辛-纳甘步枪。', keywords: [] },
    { name: '近卫步兵师', cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 3, hp: 6, desc: '身经百战的精锐步兵，战斗意志坚强。', keywords: [Keyword.GUARD] },
    { name: '政委', cat: UnitCategory.INFANTRY, cost: 2, atk: 3, def: 2, hp: 4, desc: '"绝不后退一步！" 提升部队士气。', keywords: [Keyword.BLITZ] },
    { name: 'T-34/76 中型坦克', cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 5, hp: 8, desc: '倾斜装甲与机动性的完美结合，苏联装甲主力。', keywords: [Keyword.BLITZ] },
    { name: 'T-34/85 中型坦克', cat: UnitCategory.ARMOR, cost: 6, atk: 7, def: 6, hp: 9, desc: '换装了85mm火炮的改进型T-34，足以对抗德军重甲。', keywords: [Keyword.BLITZ] },
    { name: 'IS-2 重型坦克', cat: UnitCategory.ARMOR, cost: 8, atk: 10, def: 8, hp: 12, desc: '搭载122mm主炮的钢铁巨兽，专为摧毁德军重甲而生。', keywords: [Keyword.HEAVY_ARMOR] },
    { name: 'SU-85 自行火炮', cat: UnitCategory.ARTILLERY, cost: 6, atk: 8, def: 4, hp: 6, desc: '强大的反坦克火力，能够在远距离击穿装甲。', keywords: [Keyword.AMBUSH] },
    { name: 'IL-2 攻击机', cat: UnitCategory.AIR_FORCE, cost: 7, atk: 9, def: 2, hp: 5, desc: '"飞行坦克"，对地攻击的绝对利器。', keywords: [Keyword.BLITZ] },
    { name: '喀秋莎火箭车', cat: UnitCategory.ARTILLERY, cost: 5, atk: 7, def: 1, hp: 4, desc: '齐射时发出恐怖的呼啸声，火力覆盖面极广。', keywords: [] },
    { name: 'KV-1 重型坦克', cat: UnitCategory.ARMOR, cost: 7, atk: 6, def: 9, hp: 14, desc: '战争初期的移动堡垒，德军的反坦克炮对其毫无作用。', keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD] }
  ];
}

function getGermanUnits(): any[] {
  return [
    { name: '国民突击队', cat: UnitCategory.INFANTRY, cost: 1, atk: 2, def: 1, hp: 2, desc: '战争后期的民兵武装，缺乏训练但装备铁拳反坦克炮。', keywords: [] },
    { name: '国防军步兵', cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 4, hp: 5, desc: '训练有素的正规军，战术素养极高。', keywords: [] },
    { name: '党卫军装甲掷弹兵', cat: UnitCategory.INFANTRY, cost: 4, atk: 5, def: 4, hp: 6, desc: '狂热的精锐步兵，跟随装甲部队快速突击。', keywords: [Keyword.BLITZ] },
    { name: '四号中型坦克', cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 5, hp: 7, desc: '德军装甲部队的绝对中坚，活跃于各个战场。', keywords: [Keyword.BLITZ] },
    { name: '豹式中型坦克', cat: UnitCategory.ARMOR, cost: 7, atk: 8, def: 7, hp: 9, desc: '拥有极佳的火炮与正面装甲，性能优异。', keywords: [Keyword.HEAVY_ARMOR] },
    { name: '虎式重型坦克', cat: UnitCategory.ARMOR, cost: 9, atk: 12, def: 10, hp: 10, desc: '盟军的梦魇，以其厚重的装甲和88mm主炮闻名。', keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD] },
    { name: 'Sdkfz 251 半履带车', cat: UnitCategory.ARMOR, cost: 4, atk: 3, def: 4, hp: 6, desc: '搭载步兵快速机动的装甲车辆。', keywords: [Keyword.BLITZ] },
    { name: '88毫米高射炮', cat: UnitCategory.ARTILLERY, cost: 6, atk: 10, def: 2, hp: 5, desc: '不仅能防空，更是致命的反坦克武器。', keywords: [Keyword.ANTI_AIR, Keyword.GUARD] },
    { name: 'Bf-109 战斗机', cat: UnitCategory.AIR_FORCE, cost: 6, atk: 8, def: 3, hp: 4, desc: '德国空军的主力战斗机，争夺制空权的关键。', keywords: [Keyword.BLITZ] },
    { name: 'Ju-87 斯图卡', cat: UnitCategory.AIR_FORCE, cost: 7, atk: 10, def: 2, hp: 4, desc: '伴随恐怖尖啸声的俯冲轰炸机，能精确打击地面目标。', keywords: [Keyword.BLITZ] }
  ];
}

function getUSAUnits(): any[] {
  return [
    { name: '大兵(G.I.)', cat: UnitCategory.INFANTRY, cost: 2, atk: 3, def: 2, hp: 4, desc: '装备M1加兰德的美国大兵，火力充足。', keywords: [] },
    { name: '游骑兵', cat: UnitCategory.INFANTRY, cost: 4, atk: 5, def: 3, hp: 5, desc: '精锐的突击步兵，擅长敌后作战。', keywords: [Keyword.AMBUSH] },
    { name: 'M4 谢尔曼', cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 5, hp: 8, desc: '产量极大的中型坦克，可靠性强。', keywords: [Keyword.BLITZ] },
    { name: 'M26 潘兴', cat: UnitCategory.ARMOR, cost: 8, atk: 9, def: 8, hp: 10, desc: '战争后期投入战场的重型坦克，足以对抗虎豹。', keywords: [Keyword.HEAVY_ARMOR] },
    { name: 'M7 牧师自行火炮', cat: UnitCategory.ARTILLERY, cost: 5, atk: 7, def: 3, hp: 5, desc: '为装甲部队提供伴随火力的自行火炮。', keywords: [] },
    { name: 'P-51 野马', cat: UnitCategory.AIR_FORCE, cost: 7, atk: 8, def: 3, hp: 5, desc: '优秀的护航战斗机。', keywords: [Keyword.BLITZ] },
    { name: 'B-17 飞行堡垒', cat: UnitCategory.AIR_FORCE, cost: 9, atk: 10, def: 5, hp: 12, desc: '重型战略轰炸机，拥有极其坚固的机身和密集的自卫火力。', keywords: [Keyword.HEAVY_ARMOR] }
  ];
}

function getUKUnits(): any[] {
  return [
    { name: '汤米步兵', cat: UnitCategory.INFANTRY, cost: 2, atk: 3, def: 3, hp: 5, desc: '坚韧的英国步兵。', keywords: [Keyword.GUARD] },
    { name: '红魔伞兵', cat: UnitCategory.INFANTRY, cost: 4, atk: 5, def: 2, hp: 4, desc: '精锐的空降部队，随时准备空降敌后。', keywords: [Keyword.BLITZ] },
    { name: '十字军巡航坦克', cat: UnitCategory.ARMOR, cost: 4, atk: 5, def: 3, hp: 6, desc: '速度极快的巡航坦克，活跃于北非战场。', keywords: [Keyword.BLITZ] },
    { name: '丘吉尔步兵坦克', cat: UnitCategory.ARMOR, cost: 6, atk: 5, def: 8, hp: 10, desc: '装甲极其厚重，推进缓慢。', keywords: [Keyword.HEAVY_ARMOR] },
    { name: '25磅榴弹炮', cat: UnitCategory.ARTILLERY, cost: 5, atk: 6, def: 2, hp: 5, desc: '英军标志性的轻型野战火炮。', keywords: [] },
    { name: '喷火战斗机', cat: UnitCategory.AIR_FORCE, cost: 7, atk: 9, def: 2, hp: 4, desc: '不列颠空战的传奇。', keywords: [Keyword.BLITZ] },
    { name: '兰开斯特轰炸机', cat: UnitCategory.AIR_FORCE, cost: 8, atk: 9, def: 4, hp: 10, desc: '皇家空军轰炸机司令部的主力，载弹量极大。', keywords: [Keyword.HEAVY_ARMOR] }
  ];
}

function getFranceUnits(): any[] {
  return [
    { name: '外籍军团', cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 3, hp: 6, desc: '精锐的外籍军团士兵。', keywords: [Keyword.GUARD] },
    { name: 'S35 骑兵坦克', cat: UnitCategory.ARMOR, cost: 4, atk: 5, def: 5, hp: 7, desc: '机动性与装甲兼顾的优秀坦克。', keywords: [Keyword.BLITZ] },
    { name: 'B1 重型坦克', cat: UnitCategory.ARMOR, cost: 6, atk: 7, def: 7, hp: 9, desc: '战前欧洲最强坦克之一。', keywords: [Keyword.HEAVY_ARMOR] },
    { name: '自由法国游击队', cat: UnitCategory.INFANTRY, cost: 2, atk: 4, def: 1, hp: 3, desc: '在敌后进行破坏活动的抵抗力量。', keywords: [Keyword.AMBUSH] }
  ];
}

// --- 高级隐藏单位库 (通过军校解锁) ---
export const ADVANCED_CARDS_DATA = [
  { id: 'adv-soviet-1', name: '斯大林格勒近卫师', faction: Faction.SOVIET, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 5, atk: 6, def: 5, hp: 8, desc: '【高级】经历过最残酷巷战的钢铁部队。', keywords: [Keyword.GUARD, Keyword.AMBUSH] },
  { id: 'adv-german-1', name: '虎王重型坦克', faction: Faction.GERMANY, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 10, atk: 15, def: 12, hp: 15, desc: '【高级】无敌的正面装甲，盟军装甲的终极噩梦。', keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD] },
  { id: 'adv-usa-1', name: '101空降师 "啸鹰"', faction: Faction.USA, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 6, atk: 7, def: 4, hp: 6, desc: '【高级】"从天而降，包围敌军"！', keywords: [Keyword.BLITZ, Keyword.AMBUSH] },
  { id: 'adv-uk-1', name: 'SAS 特种空勤团', faction: Faction.UK, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 5, atk: 8, def: 3, hp: 5, desc: '【高级】"勇者必胜"，执行最高难度破坏任务。', keywords: [Keyword.BLITZ, Keyword.AMBUSH] },
  { id: 'adv-france-1', name: '自由法国装甲师', faction: Faction.FRANCE, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 7, atk: 8, def: 7, hp: 9, desc: '【高级】为光复祖国而战的精锐装甲力量。', keywords: [Keyword.BLITZ, Keyword.HEAVY_ARMOR] },
];

export const ADVANCED_ORDERS_DATA = [
  {
    id: 'adv-order-soviet', name: '朱可夫的决断', faction: Faction.SOVIET, type: CardType.ORDER, cost: 6, desc: '【高级指令】最高统帅部下达总攻命令！我方全军攻击力+3，血量+3。',
    effect: (game: Game) => { game.currentPlayer.board.forEach(u => { u.attack += 3; u.hp += 3; u.maxHp += 3; }); }
  },
  {
    id: 'adv-order-german', name: '古德里安的装甲矛头', faction: Faction.GERMANY, type: CardType.ORDER, cost: 6, desc: '【高级指令】突破极限！我方所有单位恢复行动，并获得重甲。',
    effect: (game: Game) => { game.currentPlayer.board.forEach(u => { u.hasAttackedThisTurn = false; u.hasMovedThisTurn = false; if(!u.keywords.includes(Keyword.HEAVY_ARMOR)) u.keywords.push(Keyword.HEAVY_ARMOR); }); }
  },
  {
    id: 'adv-order-usa', name: '曼哈顿计划', faction: Faction.USA, type: CardType.ORDER, cost: 10, desc: '【高级指令】终极武器！对敌方总部直接造成 12 点毁灭性伤害。',
    effect: (game: Game) => { const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1; enemy.takeHqDamage(12); }
  },
];

// --- 真实历史背景指令卡 ---
function createGenericOrders(faction: Faction): OrderCard[] {
  return [
    {
      id: `${faction}-order-1`, name: '战术补给', description: '抽2张牌，恢复总部3点血。',
      type: CardType.ORDER, faction: faction, deployCost: 3,
      effect: (game: Game) => {
        const p = game.currentPlayer;
        p.drawCard(2); p.hqHp = Math.min(25, p.hqHp + 3);
      }
    },
    {
      id: `${faction}-order-2`, name: '火力压制', description: '对敌方所有支援战线单位造成2点伤害。',
      type: CardType.ORDER, faction: faction, deployCost: 4,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        enemy.board.forEach(u => {
          if (u.line === 'support') u.hp -= 2;
        });
        enemy.board = enemy.board.filter(u => u.hp > 0);
      }
    }
  ];
}

function createSovietOrders(): OrderCard[] {
  return [
    {
      id: 'soviet-order-ura', name: '乌拉冲锋', description: '全线反击！我方所有场上单位攻击力+2，血量+1。',
      type: CardType.ORDER, faction: Faction.SOVIET, deployCost: 3,
      effect: (game: Game) => {
        game.currentPlayer.board.forEach(u => { u.attack += 2; u.hp += 1; u.maxHp += 1; });
      }
    },
    {
      id: 'soviet-order-katyusha', name: '喀秋莎洗地', description: '炮火覆盖！对敌方所有单位造成 3 点伤害。',
      type: CardType.ORDER, faction: Faction.SOVIET, deployCost: 4,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        enemy.board.forEach(u => u.hp -= 3);
        enemy.board = enemy.board.filter(u => u.hp > 0);
      }
    }
  ];
}

function createGermanOrders(): OrderCard[] {
  return [
    {
      id: 'german-order-blitzkrieg', name: '闪电战', description: '装甲突袭！摸2张牌，恢复我方所有单位行动状态，并获得2点CP。',
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 3,
      effect: (game: Game) => {
        const player = game.currentPlayer;
        player.drawCard(2);
        player.cp += 2;
        player.board.forEach(u => { u.hasAttackedThisTurn = false; u.hasMovedThisTurn = false; });
      }
    },
    {
      id: 'german-order-v2', name: 'V2火箭', description: '战略打击！无视前线，直接对敌方总部造成 6 点伤害。',
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 5,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        enemy.takeHqDamage(6);
      }
    }
  ];
}

function createUSAOrders(): OrderCard[] {
  return [
    {
      id: 'usa-order-carpet', name: 'B-17地毯轰炸', description: '空中打击！对敌方支援战线的所有单位造成 4 点伤害。',
      type: CardType.ORDER, faction: Faction.USA, deployCost: 5,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        enemy.board.forEach(u => {
          if (u.line === 'support') u.hp -= 4;
        });
        enemy.board = enemy.board.filter(u => u.hp > 0);
      }
    },
    {
      id: 'usa-order-logistics', name: '后勤优势', description: '强大的工业能力！抽3张牌，并获得3点指挥点。',
      type: CardType.ORDER, faction: Faction.USA, deployCost: 4,
      effect: (game: Game) => {
        const player = game.currentPlayer;
        player.drawCard(3);
        player.cp += 3;
      }
    }
  ];
}

function createUKOrders(): OrderCard[] {
  return [
    {
      id: 'uk-order-radar', name: '雷达预警', description: '提前部署！抽2张牌，我方所有单位防御力+1。',
      type: CardType.ORDER, faction: Faction.UK, deployCost: 3,
      effect: (game: Game) => {
        const player = game.currentPlayer;
        player.drawCard(2);
        player.board.forEach(u => u.defense += 1);
      }
    },
    {
      id: 'uk-order-navy', name: '皇家海军支援', description: '舰炮轰击！对敌方所有单位造成 4 点伤害。',
      type: CardType.ORDER, faction: Faction.UK, deployCost: 5,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        enemy.board.forEach(u => {
          u.hp -= 4;
        });
        enemy.board = enemy.board.filter(u => u.hp > 0);
      }
    }
  ];
}

function createFranceOrders(): OrderCard[] {
  return [
    {
      id: 'france-order-maginot', name: '马奇诺防线', description: '坚固设防！总部恢复5点血量，我方所有单位获得重甲（防御力+2）。',
      type: CardType.ORDER, faction: Faction.FRANCE, deployCost: 4,
      effect: (game: Game) => {
        const player = game.currentPlayer;
        player.hqHp = Math.min(25, player.hqHp + 5);
        player.board.forEach(u => {
          u.defense += 2;
          if (!u.keywords.includes(Keyword.HEAVY_ARMOR)) {
            u.keywords.push(Keyword.HEAVY_ARMOR);
          }
        });
      }
    },
    {
      id: 'france-order-resistance', name: '抵抗运动', description: '敌后破坏！对敌方随机3个单位造成 2 点伤害。',
      type: CardType.ORDER, faction: Faction.FRANCE, deployCost: 3,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        if (enemy.board.length > 0) {
           for(let i=0; i<3; i++) {
             if (enemy.board.length === 0) break;
             const target = enemy.board[Math.floor(Math.random() * enemy.board.length)];
             target.hp -= 2;
             enemy.board = enemy.board.filter(u => u.hp > 0);
           }
        }
      }
    }
  ];
}

function buildDeck(faction: Faction): any[] {
  const deck: any[] = [];
  let factionOrders;
  switch (faction) {
    case Faction.SOVIET: factionOrders = createSovietOrders(); break;
    case Faction.GERMANY: factionOrders = createGermanOrders(); break;
    case Faction.USA: factionOrders = createUSAOrders(); break;
    case Faction.UK: factionOrders = createUKOrders(); break;
    case Faction.FRANCE: factionOrders = createFranceOrders(); break;
    default: factionOrders = createGenericOrders(faction);
  }
  
  let factionUnits;
  switch (faction) {
    case Faction.SOVIET: factionUnits = getSovietUnits(); break;
    case Faction.GERMANY: factionUnits = getGermanUnits(); break;
    case Faction.USA: factionUnits = getUSAUnits(); break;
    case Faction.UK: factionUnits = getUKUnits(); break;
    case Faction.FRANCE: factionUnits = getFranceUnits(); break;
    default: factionUnits = getSovietUnits();
  }
  
  // 注入已解锁的高级卡牌
  let unlockedIds: string[] = [];
  try {
    unlockedIds = JSON.parse(localStorage.getItem('unlockedCards') || '[]');
  } catch(e) {}

  const myAdvancedUnits = ADVANCED_CARDS_DATA.filter(c => c.faction === faction && unlockedIds.includes(c.id));
  const myAdvancedOrders = ADVANCED_ORDERS_DATA.filter(c => c.faction === faction && unlockedIds.includes(c.id));

  for (let i = 1; i <= 60; i++) {
    // 每10张牌尝试随机塞入一张高级牌
    if (i % 10 === 0 && (myAdvancedUnits.length > 0 || myAdvancedOrders.length > 0)) {
       const pool = [...myAdvancedUnits, ...myAdvancedOrders];
       const adv = pool[Math.floor(Math.random() * pool.length)];
       if (adv.type === CardType.UNIT) {
          deck.push({
            id: `${adv.id}-${i}`, name: adv.name, description: adv.desc, type: CardType.UNIT, category: adv.cat, faction: adv.faction,
            deployCost: adv.cost, attack: adv.atk, defense: adv.def, hp: adv.hp, maxHp: adv.hp, moveCost: 1, keywords: adv.keywords || [],
            hasMovedThisTurn: false, hasAttackedThisTurn: false, line: 'support', isAdvanced: true
          } as UnitCard);
       } else {
          deck.push({ ...adv, id: `${adv.id}-${i}`, isAdvanced: true, deployCost: adv.cost });
       }
       continue;
    }

    if (i % 4 === 0 || i % 4 === 3) {
      const randomOrder = factionOrders[Math.floor(Math.random() * factionOrders.length)];
      deck.push({ ...randomOrder, id: `${randomOrder.id}-${i}` });
    } else {
      const u = factionUnits[Math.floor(Math.random() * factionUnits.length)];
      deck.push({
        id: `${faction}-unit-${i}`,
        name: u.name,
        description: u.desc,
        type: CardType.UNIT,
        category: u.cat,
        faction: faction,
        deployCost: u.cost,
        attack: u.atk,
        defense: u.def,
        hp: u.hp,
        maxHp: u.hp,
        moveCost: 1, // 默认移动消耗1点CP
        keywords: u.keywords || [],
        hasMovedThisTurn: false,
        hasAttackedThisTurn: false,
        line: 'support' // 初始进入支援战线
      } as UnitCard);
    }
  }
  return deck;
}

export default function App() {
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>('lobby');
  const [playerFaction, setPlayerFaction] = useState<Faction>(Faction.SOVIET);
  const [aiFaction, setAiFaction] = useState<Faction>(Faction.GERMANY);
  
  const [gameMode, setGameMode] = useState<'ai' | 'multiplayer'>('ai');
  const [roomId, setRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [remoteState, setRemoteState] = useState<any>(null);

  const [game, setGame] = useState<Game | null>(null);
  const [, setTick] = useState(0);
  const isAITurnRunning = useRef(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [showAcademy, setShowAcademy] = useState(false);

  const forceUpdate = () => setTick(t => t + 1);

  // 交互状态
  const [selectedBoardUnit, setSelectedBoardUnit] = useState<{player: 'p1'|'p2', index: number} | null>(null);

  // 动画状态
  const [hiddenHandIndex, setHiddenHandIndex] = useState<number | null>(null);
  const [playingAnim, setPlayingAnim] = useState<{ card: BaseCard; index: number; status: 'hover' | 'slam' | 'slide'; statsSum: number; player: 'p1' | 'p2' } | null>(null);
  const [attackAnim, setAttackAnim] = useState<{ attackerId: string, defenderId: string, phase: 'windup' | 'strike' } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [globalShake, setGlobalShake] = useState(0);
  const [flash, setFlash] = useState<'red' | 'white' | null>(null);
  const [turnBanner, setTurnBanner] = useState<string | null>(null);
  const [orderVfx, setOrderVfx] = useState<{ type: 'explosions' | 'nuke' | 'buff', area: 'p1-support' | 'p2-support' | 'p1-hq' | 'p2-hq' | 'p1-board' | 'p2-board' | 'p1-frontline' | 'p2-frontline' } | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const startGame = () => {
    const p1 = new Player("指挥官 (我方)", playerFaction, buildDeck(playerFaction));
    const p2 = new Player(gameMode === 'ai' ? "AI 指挥官 (敌方)" : "敌方指挥官", aiFaction, buildDeck(aiFaction));
    const newGame = new Game(p1, p2);
    newGame.startGame();
    setGame(newGame);
    setGamePhase('playing');
    
    if (gameMode === 'multiplayer' && networkManager.isHost) {
      networkManager.send({ type: 'GAME_START', p1Faction: playerFaction, p2Faction: aiFaction });
      networkManager.send({ type: 'SYNC_STATE', state: newGame.serialize() });
    }
  };

  useEffect(() => {
    if (gameMode !== 'multiplayer') return;
    
    networkManager.onOpenCb = (id) => {
      setRoomId(id);
      setConnectionStatus(`等待对手加入... (房间码: ${id})`);
    };

    networkManager.onConnectionCb = (conn) => {
      setConnectionStatus('已连接！');
      if (networkManager.isHost) {
        if (game) networkManager.send({ type: 'SYNC_STATE', state: game.serialize() });
      }
    };

    networkManager.onDataCb = (data: NetworkAction) => {
      if (data.type === 'SYNC_STATE') {
        setRemoteState(data.state);
        if (gamePhase === 'lobby') setGamePhase('playing');
      } else if (data.type === 'GAME_START') {
        setPlayerFaction(data.p2Faction as Faction);
        setAiFaction(data.p1Faction as Faction);
        setGamePhase('playing');
      } else if (data.type === 'VFX') {
        playOrderVFX(data.cardId, data.isP1);
      }
      
      // If we are host, process incoming actions from client
      if (networkManager.isHost && game) {
        if (data.type === 'END_TURN') {
          game.nextTurn();
        } else if (data.type === 'PLAY_CARD') {
          const card = game.player2.hand[data.index];
          game.player2.playCard(data.index, game);
          if (card && card.type === CardType.ORDER) {
            playOrderVFX(card.id, false);
            networkManager.send({ type: 'VFX', cardId: card.id, isP1: false });
          }
        } else if (data.type === 'MOVE_UNIT') {
          game.moveUnit(game.player2, game.player1, game.player2.board[data.index]);
        } else if (data.type === 'ATTACK_UNIT') {
          game.attackUnit(game.player2.board[data.attackerIndex], game.player1.board[data.defenderIndex], game.player2, game.player1);
        } else if (data.type === 'ATTACK_HQ') {
          game.attackHQ(game.player2.board[data.attackerIndex], game.player1);
        }
        forceUpdate();
        networkManager.send({ type: 'SYNC_STATE', state: game.serialize() });
      }
    };

  }, [gameMode, game, gamePhase]);
  useEffect(() => {
    if (!game || gamePhase !== 'playing' || gameMode === 'multiplayer') return;
    const p1 = game.player1;
    const p2 = game.player2;

    if (game.currentPlayer === p2 && !isAITurnRunning.current) {
      isAITurnRunning.current = true;
      const playAITurn = async () => {
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(1000);

        // 1. AI 部署卡牌
        let canPlay = true;
        while (canPlay && p2.hqHp > 0 && p1.hqHp > 0) {
          const affordableCards = p2.hand.map((card, index) => ({ card, index })).filter(item => item.card.deployCost <= p2.cp);
          if (affordableCards.length > 0) {
            affordableCards.sort((a, b) => b.card.deployCost - a.card.deployCost);
            const cardToPlay = affordableCards[0].card;
            const indexToPlay = affordableCards[0].index;

            const isUnit = cardToPlay.type === CardType.UNIT;
            let statsSum = isUnit ? cardToPlay.deployCost + (cardToPlay as UnitCard).attack + (cardToPlay as UnitCard).hp : cardToPlay.deployCost * 2;

            setPlayingAnim({ card: cardToPlay, index: indexToPlay, status: 'hover', statsSum, player: 'p2' });
            await sleep(Math.min(1500, 500 + statsSum * 40));

            if (isUnit) {
              setPlayingAnim(p => p ? { ...p, status: 'slam' } : null);
              setGlobalShake(Math.min(40, statsSum * 1.5));
              await sleep(150);
              setGlobalShake(0);
              await sleep(150);
            } else {
              setPlayingAnim(p => p ? { ...p, status: 'slide' } : null);
              await sleep(400);
            }

            p2.playCard(indexToPlay, game);
            setPlayingAnim(null);
            forceUpdate();
            
            if (cardToPlay.type === CardType.ORDER) {
              await playOrderVFX(cardToPlay.id, false);
            } else {
              await sleep(800);
            }
          } else {
            canPlay = false;
          }
        }

        // 2. AI 移动阶段
        const supports = p2.board.filter(u => u.line === 'support' && !u.hasMovedThisTurn);
        for (const unit of supports) {
          if (game.moveUnit(p2, p1, unit)) {
            forceUpdate();
            await sleep(500);
          }
        }

        // 3. AI 攻击阶段
        const attackers = p2.board.filter(u => !u.hasAttackedThisTurn);
        for (const unit of attackers) {
          if (!p2.board.includes(unit)) continue;
          if (p2.hqHp <= 0 || p1.hqHp <= 0) break;

          let validTargets = p1.board;
          // 步兵不打空军
          if (unit.category === UnitCategory.INFANTRY) validTargets = validTargets.filter(t => t.category !== UnitCategory.AIR_FORCE);
          
          // 射程限制
          if (unit.category !== UnitCategory.ARTILLERY && unit.category !== UnitCategory.AIR_FORCE) {
             if (unit.line === 'support') {
                 validTargets = validTargets.filter(t => t.line === 'frontline');
             }
          }

          if (validTargets.length > 0) {
            const target = [...validTargets].sort((a, b) => a.hp - b.hp)[0];
            await executeAttack(unit, target, p2, p1);
          } else {
            // Check if can attack HQ
            const guards = p1.board.filter(u => u.keywords.includes(Keyword.GUARD));
            const canAtkHq = (unit.category === UnitCategory.ARTILLERY || unit.category === UnitCategory.AIR_FORCE) || (unit.line === 'frontline');
            if (guards.length === 0 && canAtkHq) {
                await executeAttack(unit, 'hq', p2, p1);
            }
          }
          forceUpdate();
          await sleep(500);
        }

        await sleep(500);
        isAITurnRunning.current = false;
        if (p1.hqHp > 0 && p2.hqHp > 0) handleEndTurn();
      };
      playAITurn();
    }
  }, [game?.currentPlayer, game?.turnNumber, gamePhase]);

  // 回合切换横幅动画
  useEffect(() => {
    if (gamePhase === 'playing' && game) {
      setTurnBanner(game.currentPlayer === game.player1 ? '我方回合' : '敌方回合');
      const t = setTimeout(() => setTurnBanner(null), 1500);
      return () => clearTimeout(t);
    }
  }, [game?.turnNumber, gamePhase]);

  if (gamePhase === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] relative">
        
        {/* 游戏教程按钮 */}
        <div className="absolute top-8 right-8 flex flex-col gap-3">
          <button 
            onClick={() => setShowTutorial(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transition-colors border-2 border-blue-400"
          >
            📖 游戏教程
          </button>
          <button 
            onClick={() => setShowAcademy(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transition-colors border-2 border-amber-400"
          >
            🏛️ 历史军校 (解锁卡牌)
          </button>
        </div>

        <h1 className="text-6xl font-black mb-8 tracking-widest text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">二战卡牌风云</h1>
        
        <div className="flex gap-4 mb-8">
          <button onClick={() => setGameMode('ai')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'ai' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>单人 (VS AI)</button>
          <button onClick={() => setGameMode('multiplayer')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'multiplayer' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>联机对战</button>
        </div>

        <div className="flex gap-16 bg-black/50 p-12 rounded-2xl border-4 border-gray-700 shadow-2xl relative">
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4">选择您的阵营</h2>
            <div className="flex flex-col gap-3">
              {Object.values(Faction).map(f => (
                <button 
                  key={f} onClick={() => setPlayerFaction(f)}
                  className={`px-8 py-3 rounded font-bold transition-all ${playerFaction === f ? 'bg-red-700 text-white border-2 border-red-400 scale-110' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <h2 className="text-2xl font-bold mb-4">{gameMode === 'ai' ? '选择敌方阵营' : '联机大厅'}</h2>
            {gameMode === 'ai' ? (
              <div className="flex flex-col gap-3">
                {Object.values(Faction).map(f => (
                  <button 
                    key={f} onClick={() => setAiFaction(f)}
                    className={`px-8 py-3 rounded font-bold transition-all ${aiFaction === f ? 'bg-gray-200 text-black border-2 border-white scale-110' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            ) : (
              <div className="w-64 bg-gray-800 p-6 rounded-lg border border-gray-600 flex flex-col gap-4">
                <div className="flex gap-2">
                  <button onClick={() => { setIsHost(true); networkManager.initHost(); }} className={`flex-1 py-2 text-sm rounded font-bold ${isHost ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>创建房间</button>
                  <button onClick={() => setIsHost(false)} className={`flex-1 py-2 text-sm rounded font-bold ${!isHost ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>加入房间</button>
                </div>
                
                {isHost ? (
                  <div className="text-center text-gray-300 text-sm p-4 bg-black/40 rounded border border-gray-700 min-h-[100px] flex items-center justify-center break-all">
                    {connectionStatus || "点击上方按钮生成房间码"}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      placeholder="输入主机房间码" 
                      value={roomId}
                      onChange={e => setRoomId(e.target.value)}
                      className="bg-black/50 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button 
                      onClick={() => { networkManager.initClient(roomId); setConnectionStatus('正在连接...'); }}
                      className="bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm font-bold transition-colors"
                    >
                      连接主机
                    </button>
                    <div className="text-center text-xs text-gray-400 mt-2">{connectionStatus}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {(gameMode === 'ai' || (gameMode === 'multiplayer' && isHost && connectionStatus === '已连接！')) && (
          <button onClick={startGame} className="mt-12 bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-16 rounded-xl border-b-4 border-yellow-800 text-3xl transition-transform hover:-translate-y-1 active:translate-y-1 active:border-b-0">
            进入战场
          </button>
        )}

        {/* 教程弹窗 */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
                className="bg-gray-800 border-2 border-gray-600 rounded-xl p-8 max-w-4xl w-full max-h-full overflow-y-auto relative"
              >
                <button onClick={() => setShowTutorial(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
                <h2 className="text-3xl font-bold mb-6 text-center text-amber-500 border-b border-gray-600 pb-4">📖 二战卡牌风云 - 游戏教程</h2>
                
                <div className="space-y-6 text-gray-300 leading-relaxed">
                  <section>
                    <h3 className="text-xl font-bold text-white mb-2">1. 基础规则</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>双方初始各有 25 点总部血量，血量归零即为失败。</li>
                      <li>每回合自动增加最大指挥点 (CP)，最高可达 30 点，回合开始时回满。</li>
                      <li>每回合开始自动抽 1 张牌，手牌上限为 10 张。</li>
                    </ul>
                  </section>
                  
                  <section>
                    <h3 className="text-xl font-bold text-white mb-2">2. 战场与部署</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>战场分为三层：<strong>己方支援战线</strong> -&gt; <strong>前线交火区</strong> -&gt; <strong>敌方支援战线</strong>。</li>
                      <li>打出的单位默认部署在<strong>支援战线</strong>，需要消耗对应的部署指挥点 (左上角数值)。</li>
                      <li>刚部署的单位本回合无法攻击（除非拥有【闪击】词条）。</li>
                      <li>近战单位（步兵/装甲）只有在<strong>敌方前线没有单位阻挡</strong>时，才能消耗移动点推进到前线。</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-white mb-2">3. 战斗与射程</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>近战单位 (步兵/装甲)</strong>：处于支援战线时，只能攻击敌方前线单位；进入前线后，才能攻击敌方支援战线单位或总部。</li>
                      <li><strong>远程单位 (炮兵/空军)</strong>：无视战线距离，可直接打击任意合法目标。</li>
                      <li><strong>兵种克制</strong>：步兵无法攻击空军。</li>
                      <li><strong>伤害结算</strong>：攻击力先扣除目标的防御力，若攻击力 &gt; 防御力，多出的部分才会扣除目标血量。</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-white mb-2">4. 特殊词条</h3>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><span className="text-yellow-400 font-bold">闪击</span>：部署当回合即可行动/攻击。</li>
                      <li><span className="text-blue-400 font-bold">守护</span>：该单位存活时，敌方无法直接攻击我方总部。</li>
                      <li><span className="text-gray-400 font-bold">重甲</span>：受到的所有伤害强制 -2。</li>
                      <li><span className="text-red-400 font-bold">伏击</span>：受击存活后，会对攻击者进行反击。</li>
                    </ul>
                  </section>
                  
                  <section>
                    <h3 className="text-xl font-bold text-white mb-2">5. 联机指南</h3>
                    <ol className="list-decimal pl-5 space-y-1 bg-black/30 p-4 rounded border border-gray-700">
                      <li>选择“联机对战”模式。</li>
                      <li><strong>玩家A</strong> 点击“创建房间”，等待生成一段代码（房间码）。</li>
                      <li><strong>玩家A</strong> 将代码发给玩家B。</li>
                      <li><strong>玩家B</strong> 点击“加入房间”，输入代码并点击“连接主机”。</li>
                      <li>连接成功后，<strong>玩家A（主机）</strong> 点击“进入战场”即可开始游戏！</li>
                    </ol>
                  </section>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showAcademy && <Academy onClose={() => setShowAcademy(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  if (!game) return null;

  const p1 = game.player1;
  const p2 = game.player2;

  const playOrderVFX = async (cardId: string, isP1: boolean) => {
    if (cardId.includes('katyusha') || cardId.includes('carpet')) {
      setOrderVfx({ type: 'explosions', area: isP1 ? 'p2-support' : 'p1-support' });
      setGlobalShake(20);
      setFlash('red');
    } else if (cardId.includes('v2')) {
      setOrderVfx({ type: 'nuke', area: isP1 ? 'p2-hq' : 'p1-hq' });
      setGlobalShake(40);
      setFlash('white');
    } else if (cardId.includes('ura') || cardId.includes('blitzkrieg') || cardId.includes('radar') || cardId.includes('maginot')) {
      setOrderVfx({ type: 'buff', area: isP1 ? 'p1-board' : 'p2-board' });
    } else if (cardId.includes('navy')) {
      setOrderVfx({ type: 'explosions', area: isP1 ? 'p2-board' : 'p1-board' });
      setGlobalShake(25);
    } else if (cardId.includes('resistance') || cardId.includes('order-2')) {
      setOrderVfx({ type: 'explosions', area: isP1 ? 'p2-board' : 'p1-board' });
      setGlobalShake(15);
    } else if (cardId.includes('logistics') || cardId.includes('order-1')) {
      setOrderVfx({ type: 'buff', area: isP1 ? 'p1-hq' : 'p2-hq' });
    }
    
    await new Promise(r => setTimeout(r, 1200));
    setOrderVfx(null);
    setGlobalShake(0);
    setFlash(null);
  };

  const executeAttack = async (attacker: UnitCard, defender: UnitCard | 'hq', pAtk: Player, pDef: Player) => {
    const defId = typeof defender === 'string' ? defender : defender.id;
    setAttackAnim({ attackerId: attacker.id, defenderId: defId, phase: 'windup' });
    await new Promise(r => setTimeout(r, 300));
    setAttackAnim({ attackerId: attacker.id, defenderId: defId, phase: 'strike' });
    await new Promise(r => setTimeout(r, 100));

    if (typeof defender === 'string') {
      const success = game.attackHQ(attacker, pDef);
      if (success) setFlash('red');
    } else {
      game.attackUnit(attacker, defender, pAtk, pDef);
    }
    
    setGlobalShake(attacker.attack * (typeof defender === 'string' ? 4 : 2) + 10);
    forceUpdate();
    await new Promise(r => setTimeout(r, 400));
    setGlobalShake(0);
    setFlash(null);
    setAttackAnim(null);
  };

  const handleDragEnd = async (_e: any, info: any, index: number, card: BaseCard) => {
    if (gameMode === 'multiplayer' && !isHost) {
      if (info.offset.y < -100) {
        networkManager.send({ type: 'PLAY_CARD', index });
      }
      return;
    }
    if (game!.currentPlayer !== p1) return;
    if (p1.cp < card.deployCost) return;

    if (info.point.y < window.innerHeight - 250) {
      const isUnit = card.type === CardType.UNIT;
      let statsSum = isUnit ? card.deployCost + (card as UnitCard).attack + (card as UnitCard).hp : card.deployCost * 2;

      setHiddenHandIndex(index);
          setPlayingAnim({ card, index, status: 'hover', statsSum, player: 'p1' });
          await new Promise(r => setTimeout(r, Math.min(1500, 500 + statsSum * 40)));

      if (isUnit) {
        setPlayingAnim(p => p ? { ...p, status: 'slam' } : null);
        setGlobalShake(Math.min(40, statsSum * 1.5));
        await new Promise(r => setTimeout(r, 150));
        setGlobalShake(0);
        await new Promise(r => setTimeout(r, 150));
      } else {
        setPlayingAnim(p => p ? { ...p, status: 'slide' } : null);
        await new Promise(r => setTimeout(r, 400));
      }

      const success = p1.playCard(index, game);
      setPlayingAnim(null);
      setHiddenHandIndex(null);
      if (success) {
        forceUpdate();
        if (!isUnit) {
          await playOrderVFX(card.id, true);
        }
      }
    }
  };

  const handleEndTurn = () => {
    if (gameMode === 'multiplayer' && !isHost) {
      networkManager.send({ type: 'END_TURN' });
      return;
    }
    game!.nextTurn();
    setSelectedBoardUnit(null);
    forceUpdate();
    if (gameMode === 'multiplayer' && isHost) {
      networkManager.send({ type: 'SYNC_STATE', state: game!.serialize() });
    }
  };

  // 攻击或移动验证
  const handleBoardUnitClick = async (owner: 'p1' | 'p2', index: number) => {
    if (gameMode === 'multiplayer' && !isHost) {
      if (owner === 'p2') {
        setSelectedBoardUnit({ player: 'p2', index });
      } else if (owner === 'p1' && selectedBoardUnit?.player === 'p2') {
        networkManager.send({ type: 'ATTACK_UNIT', attackerIndex: selectedBoardUnit.index, defenderIndex: index });
        setSelectedBoardUnit(null);
      }
      return;
    }

    if (game.currentPlayer !== p1) return;

    if (owner === 'p1') {
      if (selectedBoardUnit?.player === 'p1' && selectedBoardUnit.index === index) {
        setSelectedBoardUnit(null);
      } else {
        setSelectedBoardUnit({ player: 'p1', index });
      }
    } else if (owner === 'p2') {
      if (selectedBoardUnit?.player === 'p1') {
        const attacker = p1.board[selectedBoardUnit.index];
        const defender = p2.board[index];
        if (attacker && defender && !attacker.hasAttackedThisTurn) {
          if (attacker.category === UnitCategory.INFANTRY && defender.category === UnitCategory.AIR_FORCE) {
            showToast(`步兵无法攻击空军！`);
            setSelectedBoardUnit(null);
            return;
          }

          // 射程验证
          if (attacker.category !== UnitCategory.ARTILLERY && attacker.category !== UnitCategory.AIR_FORCE) {
             if (attacker.line === 'support' && defender.line === 'support') {
                 showToast("近战单位在支援战线只能攻击敌方前线单位！");
                 return;
             }
          }

          setSelectedBoardUnit(null);
          await executeAttack(attacker, defender, p1, p2);
        }
      }
    }
  };

  const handleAttackHQ = async () => {
    if (gameMode === 'multiplayer' && !isHost) {
      if (selectedBoardUnit?.player === 'p2') {
        networkManager.send({ type: 'ATTACK_HQ', attackerIndex: selectedBoardUnit.index });
        setSelectedBoardUnit(null);
      }
      return;
    }
    if (game!.currentPlayer !== p1) return;
    if (selectedBoardUnit?.player === 'p1') {
      const attacker = p1.board[selectedBoardUnit.index];
      if (attacker && !attacker.hasAttackedThisTurn) {
        // 射程验证
        if (attacker.category !== UnitCategory.ARTILLERY && attacker.category !== UnitCategory.AIR_FORCE) {
           if (attacker.line === 'support') {
               showToast("必须进入前线才能攻击敌方总部！");
               return;
           }
        }
        
        // 守护验证由 Game.ts 处理，这里如果失败给个提示
        const guards = p2.board.filter(u => u.keywords.includes(Keyword.GUARD));
        if (guards.length > 0) {
            showToast("必须先消灭敌方的【守护】单位！");
            return;
        }

        setSelectedBoardUnit(null);
        await executeAttack(attacker, 'hq', p1, p2);
      }
    }
  };

  const handleMoveFrontline = () => {
    if (gameMode === 'multiplayer' && !isHost) {
      if (selectedBoardUnit?.player === 'p2') {
        networkManager.send({ type: 'MOVE_UNIT', index: selectedBoardUnit.index });
        setSelectedBoardUnit(null);
      }
      return;
    }
    if (game.currentPlayer !== p1) return;
    if (selectedBoardUnit?.player === 'p1') {
      const unit = p1.board[selectedBoardUnit.index];
      if (game.moveUnit(p1, p2, unit)) {
         setSelectedBoardUnit(null);
         forceUpdate();
      } else {
         if (p1.cp < unit.moveCost) showToast("CP不足！");
         else showToast("无法移动，敌方可能控制着前线！");
      }
    }
  };

  const renderUnit = (unit: UnitCard, owner: 'p1'|'p2', i: number) => {
    const isAttacker = attackAnim?.attackerId === unit.id;
    const isDefender = attackAnim?.defenderId === unit.id && attackAnim.phase === 'strike';
    const isP1 = owner === 'p1';

    return (
      <motion.div 
        key={unit.id} layout
        initial={{ opacity: 0, scale: 0.5, y: isP1 ? 50 : -50 }}
        animate={{ 
          opacity: 1, 
          y: isAttacker ? (attackAnim.phase === 'windup' ? (isP1 ? 40 : -40) : (isP1 ? -150 : 150)) : (isDefender ? [-10, 10, -10, 10, 0] : 0),
          x: isDefender ? [-10, 10, -10, 10, 0] : 0,
          scale: isAttacker ? (attackAnim.phase === 'windup' ? 1.1 : 1.3) : (isDefender ? 0.9 : 1),
          filter: isDefender ? 'brightness(3) sepia(1) hue-rotate(-50deg) saturate(5) drop-shadow(0 0 30px red)' : 'none',
          zIndex: isAttacker ? 50 : (isDefender ? 40 : 10)
        }}
        exit={{ opacity: 0, scale: 1.5, filter: 'brightness(0) drop-shadow(0 0 50px red) blur(5px)', transition: { duration: 0.6 } }}
        transition={{ duration: isDefender ? 0.1 : 0.3 }}
        className={`transform ${isP1 ? '-rotate-1 hover:rotate-0' : 'rotate-2 hover:rotate-0'} transition-transform relative`}
      >
        {!unit.hasAttackedThisTurn && game.currentPlayer.name === (isP1 ? p1.name : p2.name) && (
          <div className="absolute -top-3 -right-3 z-20 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-green-700 animate-bounce">可行动</div>
        )}
        <CardComponent 
          card={unit} 
          onClick={() => handleBoardUnitClick(owner, i)}
          isSelected={selectedBoardUnit?.player === owner && selectedBoardUnit.index === i}
          canPlay={owner === 'p1' ? game.currentPlayer === p1 : (game.currentPlayer === p1 && selectedBoardUnit?.player === 'p1')} 
        />
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans overflow-x-hidden overflow-y-auto">
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 20 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white font-bold px-8 py-3 rounded-full shadow-2xl border-2 border-red-800"
          >{toastMsg}</motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flash && (
          <motion.div initial={{ opacity: 0.8 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}
            className={`fixed inset-0 pointer-events-none z-[150] mix-blend-overlay ${flash === 'red' ? 'bg-[radial-gradient(circle,transparent_20%,#7f1d1d_100%)]' : 'bg-white'}`}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {turnBanner && (
          <motion.div
            initial={{ scale: 3, opacity: 0, y: -100 }}
            animate={{ scale: 1, opacity: 1, y: 0, rotate: [-2, 2, 0] }}
            exit={{ scale: 1.5, opacity: 0, filter: 'blur(10px)' }}
            transition={{ type: 'spring', damping: 12, stiffness: 100 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-[160]"
          >
            <h1 className={`text-9xl font-black italic tracking-widest drop-shadow-[0_0_30px_rgba(0,0,0,1)] uppercase -rotate-6 ${turnBanner === '敌方回合' ? 'text-red-600' : 'text-blue-500'}`}>
              {turnBanner}
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 濒死警告特效 */}
      {(game?.player1?.hqHp <= 10) && (
        <motion.div 
          animate={{ opacity: [0.1, 0.5, 0.1] }} 
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
          className="fixed inset-0 pointer-events-none z-[45] bg-[radial-gradient(circle,transparent_40%,rgba(220,38,38,0.5)_100%)] mix-blend-multiply"
        />
      )}

      <AnimatePresence>
        {playingAnim && (
          <motion.div className="fixed inset-0 pointer-events-none flex items-center justify-center z-[100]">
            <motion.div
              initial={{ scale: 1.5, y: playingAnim.player === 'p1' ? 200 : -200, rotate: playingAnim.player === 'p1' ? -5 : 5 }}
              animate={
                playingAnim.status === 'hover' ? { scale: 1.5, y: playingAnim.player === 'p1' ? -200 : -50, rotate: [-5, 5, -5], transition: { rotate: { repeat: Infinity, duration: 0.2, ease: "linear" } } } 
                : playingAnim.status === 'slam' ? { scale: 1.2, y: playingAnim.player === 'p1' ? 50 : -100, rotate: 0, transition: { duration: 0.15, ease: "easeIn" } } 
                : { scale: 1.5, x: 1000, opacity: 0, transition: { duration: 0.4, ease: "easeIn" } } 
              }
            ><CardComponent card={playingAnim.card} /></motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orderVfx && (orderVfx.area === 'p1-hq' || orderVfx.area === 'p2-hq') && (
          <motion.div 
            initial={{ opacity: 1, scale: 0 }}
            animate={orderVfx.type === 'buff' ? { opacity: 0.8, scale: 2 } : { opacity: 0, scale: 5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className={`fixed ${orderVfx.area === 'p2-hq' ? 'top-10' : 'bottom-10'} left-1/2 -translate-x-1/2 z-[200] pointer-events-none rounded-full ${orderVfx.type === 'buff' ? 'bg-[radial-gradient(circle,rgba(250,204,21,1)_0%,transparent_70%)] mix-blend-screen w-[300px] h-[300px]' : 'bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,rgba(255,50,0,0.8)_30%,transparent_100%)] mix-blend-screen w-[400px] h-[400px]'}`}
          />
        )}
      </AnimatePresence>

      <motion.div animate={attackAnim?.defenderId === 'hq' && game.currentPlayer === p1 ? { x: [-10, 10, -10, 10, 0], backgroundColor: ['#1f2937', '#7f1d1d', '#1f2937'] } : {}}
        className="bg-gray-800 p-4 border-b-4 border-gray-700 flex justify-between items-center shadow-lg z-10 relative">
        <div>
          <h2 className="text-xl font-bold text-gray-300">{p2.name} - {p2.faction}</h2>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="bg-red-900 px-3 py-1 rounded-full font-bold">HQ 血量: {p2.hqHp} / 25</span>
            <span className="bg-blue-900 px-3 py-1 rounded-full">指挥点: {p2.cp} / {p2.maxCp}</span>
            <span className="bg-gray-700 px-3 py-1 rounded-full">手牌数: {p2.hand.length}</span>
          </div>
        </div>
        
        {selectedBoardUnit?.player === 'p1' && (
          <div className="flex gap-4">
             {p1.board[selectedBoardUnit.index]?.line === 'support' && !p1.board[selectedBoardUnit.index]?.hasMovedThisTurn && (
                <button onClick={handleMoveFrontline} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg border-2 border-blue-800">
                  🚀 推进前线 ({p1.board[selectedBoardUnit.index].moveCost}CP)
                </button>
             )}
             {!p1.board[selectedBoardUnit.index]?.hasAttackedThisTurn && (
                <button onClick={handleAttackHQ} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded-lg border-2 border-red-800 animate-pulse">
                  ⚔ 攻击总部!
                </button>
             )}
          </div>
        )}
      </motion.div>

      <motion.div className="flex-grow flex flex-col relative p-4 gap-2 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] min-h-[600px]"
        animate={ globalShake > 0 ? { x: [-globalShake, globalShake, -globalShake, globalShake, 0], y: [-globalShake, globalShake, -globalShake, globalShake, 0] } : {} } transition={{ duration: 0.3 }}>
        <div className="pointer-events-none fixed inset-0 shadow-[inset_0_0_300px_rgba(0,0,0,1)] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay z-40"></div>

        {/* 敌方支援战线 */}
        <div className="flex-1 flex items-center justify-center gap-4 w-full border-b-2 border-dashed border-red-900/50 relative">
          <div className="absolute top-2 left-4 text-red-700/40 font-black text-3xl pointer-events-none">敌方支援战线</div>
          <AnimatePresence mode="popLayout">{p2.board.map((unit, i) => unit.line === 'support' && renderUnit(unit, 'p2', i))}</AnimatePresence>
          
          <AnimatePresence>
            {orderVfx && (orderVfx.area === 'p2-support' || orderVfx.area === 'p2-board') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }}
                className="absolute pointer-events-none z-[120] flex items-center justify-center inset-0"
              >
                {orderVfx.type === 'explosions' && (
                  <div className="w-full h-full relative">
                    {Array.from({length: 12}).map((_, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 1, scale: 0 }}
                        animate={{ opacity: 0, scale: 3 + Math.random() * 3 }}
                        transition={{ duration: 0.8, delay: Math.random() * 0.4, ease: "easeOut" }}
                        className="absolute rounded-full bg-[radial-gradient(circle,rgba(255,100,0,1)_0%,rgba(255,0,0,0.8)_40%,transparent_100%)] mix-blend-screen"
                        style={{
                          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                          width: `${100 + Math.random() * 150}px`, height: `${100 + Math.random() * 150}px`
                        }}
                      />
                    ))}
                  </div>
                )}
                {orderVfx.type === 'buff' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} className="w-full h-full bg-yellow-500 mix-blend-overlay" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 前线交火区 */}
        <div className="flex-1 flex flex-col justify-center gap-4 w-full bg-red-900/10 border-y-4 border-red-700 relative py-4">
          <div className="absolute inset-0 flex items-center justify-center text-red-500/10 font-black text-6xl tracking-widest pointer-events-none uppercase">前线交火区</div>
          
          <AnimatePresence>
            {orderVfx && (orderVfx.area === 'p2-frontline' || orderVfx.area === 'p1-frontline' || orderVfx.area === 'p2-board' || orderVfx.area === 'p1-board') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }}
                className={`absolute pointer-events-none z-[120] flex items-center justify-center
                  ${orderVfx.area.includes('p2') ? 'top-0' : 'bottom-0'} left-0 right-0 h-1/2`}
              >
                {orderVfx.type === 'explosions' && (
                  <div className="w-full h-full relative">
                    {Array.from({length: 12}).map((_, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 1, scale: 0 }}
                        animate={{ opacity: 0, scale: 3 + Math.random() * 3 }}
                        transition={{ duration: 0.8, delay: Math.random() * 0.4, ease: "easeOut" }}
                        className="absolute rounded-full bg-[radial-gradient(circle,rgba(255,100,0,1)_0%,rgba(255,0,0,0.8)_40%,transparent_100%)] mix-blend-screen"
                        style={{
                          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                          width: `${100 + Math.random() * 150}px`, height: `${100 + Math.random() * 150}px`
                        }}
                      />
                    ))}
                  </div>
                )}
                {orderVfx.type === 'buff' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} className="w-full h-full bg-yellow-500 mix-blend-overlay" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center gap-4 w-full h-1/2 items-end">
            <AnimatePresence mode="popLayout">{p2.board.map((unit, i) => unit.line === 'frontline' && renderUnit(unit, 'p2', i))}</AnimatePresence>
          </div>
          <div className="flex justify-center gap-4 w-full h-1/2 items-start">
            <AnimatePresence mode="popLayout">{p1.board.map((unit, i) => unit.line === 'frontline' && renderUnit(unit, 'p1', i))}</AnimatePresence>
          </div>
        </div>

        {/* 我方支援战线 */}
        <div className="flex-1 flex items-center justify-center gap-4 w-full border-t-2 border-dashed border-blue-900/50 relative">
          <div className="absolute bottom-2 left-4 text-blue-700/40 font-black text-3xl pointer-events-none">我方支援战线</div>
          <AnimatePresence mode="popLayout">{p1.board.map((unit, i) => unit.line === 'support' && renderUnit(unit, 'p1', i))}</AnimatePresence>

          <AnimatePresence>
            {orderVfx && (orderVfx.area === 'p1-support' || orderVfx.area === 'p1-board') && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }}
                className="absolute pointer-events-none z-[120] flex items-center justify-center inset-0"
              >
                {orderVfx.type === 'explosions' && (
                  <div className="w-full h-full relative">
                    {Array.from({length: 12}).map((_, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 1, scale: 0 }}
                        animate={{ opacity: 0, scale: 3 + Math.random() * 3 }}
                        transition={{ duration: 0.8, delay: Math.random() * 0.4, ease: "easeOut" }}
                        className="absolute rounded-full bg-[radial-gradient(circle,rgba(255,100,0,1)_0%,rgba(255,0,0,0.8)_40%,transparent_100%)] mix-blend-screen"
                        style={{
                          left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
                          width: `${100 + Math.random() * 150}px`, height: `${100 + Math.random() * 150}px`
                        }}
                      />
                    ))}
                  </div>
                )}
                {orderVfx.type === 'buff' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} className="w-full h-full bg-yellow-500 mix-blend-overlay" />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div animate={attackAnim?.defenderId === 'hq' && game.currentPlayer === p2 ? { x: [-10, 10, -10, 10, 0], backgroundColor: ['#1f2937', '#7f1d1d', '#1f2937'] } : {}}
        className="bg-gray-800 border-t-4 border-gray-700 p-4 shadow-2xl relative z-30">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">{p1.name} - {p1.faction}</h2>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="bg-red-900 px-3 py-1 rounded-full font-bold shadow-inner">HQ 血量: {p1.hqHp} / 25</span>
              <span className="bg-blue-900 px-3 py-1 rounded-full font-bold shadow-inner">指挥点(CP): <span className="text-yellow-400 text-lg">{p1.cp}</span> / {p1.maxCp}</span>
              <span className="bg-gray-700 px-3 py-1 rounded-full">牌库剩余: {p1.deck.length}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <div className={`text-xl font-bold mb-2 ${game.currentPlayer === p1 ? 'text-green-400' : 'text-gray-500'}`}>
                回合 {game.turnNumber} : {game.currentPlayer.name} 的回合
             </div>
             <button onClick={handleEndTurn} disabled={game.currentPlayer !== p1}
               className={`font-bold py-3 px-8 rounded-xl border-b-4 transition-all ${game.currentPlayer === p1 ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800 text-white active:border-b-0 active:translate-y-1' : 'bg-gray-700 text-gray-500 border-gray-900 cursor-not-allowed'}`}
             >
               {game.currentPlayer === p1 ? '结束回合' : 'AI 思考中...'}
             </button>
          </div>
        </div>

        <div className="flex justify-center -mb-4 overflow-visible pb-4 pt-2 px-4 h-48">
          <AnimatePresence>
            {p1.hand.map((card, i) => (
              <motion.div key={card.id} layout initial={{ y: 300, opacity: 0, scale: 0.5 }} animate={{ y: 0, opacity: hiddenHandIndex === i ? 0 : 1, scale: 0.85 }} exit={{ y: -200, opacity: 0, scale: 0 }} transition={{ duration: 0.3 }}
                drag={game.currentPlayer === p1 && p1.cp >= card.deployCost} dragSnapToOrigin onDragEnd={(e, info) => handleDragEnd(e, info, i, card)} whileDrag={{ scale: 1, zIndex: 50 }}
                className={`relative origin-bottom -mx-2 ${game.currentPlayer === p1 && p1.cp >= card.deployCost ? 'cursor-grab active:cursor-grabbing hover:-translate-y-8 hover:z-40 transition-transform' : 'cursor-not-allowed'}`}
              ><CardComponent card={card} canPlay={game.currentPlayer === p1 && p1.cp >= card.deployCost} /></motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>

      {(p1.hqHp <= 0 || p2.hqHp <= 0) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center flex-col">
          <h1 className="text-6xl font-bold text-red-500 mb-8 tracking-widest drop-shadow-lg">{p1.hqHp <= 0 ? '游戏失败 (DEFEAT)' : '游戏胜利 (VICTORY)'}</h1>
          <button onClick={() => window.location.reload()} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-12 rounded-xl border-b-4 border-yellow-800 text-2xl transition-transform hover:-translate-y-1 active:translate-y-1 active:border-b-0">重新开始</button>
        </div>
      )}
    </div>
  );
}
