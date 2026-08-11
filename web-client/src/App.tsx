import { useState, useEffect, useRef } from 'react';
import { Game } from './engine/Game';
import { Player } from './engine/Player';
import { Faction, CardType, UnitCategory, Keyword } from './engine/types';
import type { UnitCard, OrderCard, BaseCard } from './engine/types';
import { CardComponent } from './components/CardComponent';
import { Academy } from './components/Academy';
import { DeckBuilder } from './components/DeckBuilder';
import { motion, AnimatePresence } from 'framer-motion';
import { networkManager, type NetworkAction } from './engine/NetworkManager';
import type { Commander, EnvironmentCard, CampaignScenario } from './engine/types';
import './index.css';

// --- 指挥官系统库 ---
export const COMMANDERS_DATA: Commander[] = [
  {
    id: 'cmd-zhukov', name: '格奥尔基·朱可夫', faction: Faction.SOVIET,
    passiveName: '坚壁清野', passiveDesc: '每回合开始时，总部恢复 1 点血量。',
    activeName: '总攻令', activeDesc: '消耗 6 CP，我方场上所有单位攻击力+1，血量+1。',
    activeCost: 6, activeCooldown: 0,
    onTurnStart: (game, player) => { player.hqHp = Math.min(25, player.hqHp + 1); },
    useActive: (game, player) => { player.board.forEach((u: UnitCard) => { u.attack += 1; u.hp += 1; u.maxHp += 1; }); }
  },
  {
    id: 'cmd-rommel', name: '埃尔温·隆美尔', faction: Faction.GERMANY,
    passiveName: '装甲先锋', passiveDesc: '每回合开始时，获得 1 点额外 CP。',
    activeName: '闪电突击', activeDesc: '消耗 5 CP，我方所有装甲单位获得【闪击】。',
    activeCost: 5, activeCooldown: 0,
    onTurnStart: (game, player) => { player.cp += 1; },
    useActive: (game, player) => { player.board.filter((u: UnitCard) => u.category === UnitCategory.ARMOR).forEach((u: UnitCard) => { if(!u.keywords.includes(Keyword.BLITZ)) u.keywords.push(Keyword.BLITZ); u.hasAttackedThisTurn = false; }); }
  },
  {
    id: 'cmd-patton', name: '乔治·巴顿', faction: Faction.USA,
    passiveName: '血胆将军', passiveDesc: '你的所有步兵在部署时攻击力+1。',
    activeName: '地毯式轰炸', activeDesc: '消耗 7 CP，对敌方全场单位造成 2 点伤害。',
    activeCost: 7, activeCooldown: 0,
    onTurnStart: (game, player) => {}, // 被动在playCard时生效或者全局生效，这里简化为只影响已部署的，我们在每次更新时处理，或者写死在部署逻辑。这里用被动加成？我们改为每回合给新部署的加？太复杂。改回每回合开始时所有步兵攻击力+1？不行。改成每回合开始时，总部受伤害减免？
    // 重写被动：每回合开始时，随机使一个我方单位攻击力+1。
    useActive: (game, player) => { const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1; enemy.board.forEach((u: UnitCard) => u.hp -= 2); enemy.board = enemy.board.filter((u: UnitCard) => u.hp > 0); }
  },
  {
    id: 'cmd-monty', name: '伯纳德·蒙哥马利', faction: Faction.UK,
    passiveName: '稳扎稳打', passiveDesc: '每回合开始时，若前线有我方单位，总部恢复 2 点血量。',
    activeName: '后勤筹备', activeDesc: '消耗 3 CP，抽 2 张牌。',
    activeCost: 3, activeCooldown: 0,
    onTurnStart: (game, player) => { if(player.board.some((u: UnitCard) => u.line === 'frontline')) player.hqHp = Math.min(25, player.hqHp + 2); },
    useActive: (game, player) => { player.drawCard(2); }
  },
  {
    id: 'cmd-degaulle', name: '夏尔·戴高乐', faction: Faction.FRANCE,
    passiveName: '不屈抵抗', passiveDesc: '当总部血量低于 10 时，每回合开始额外抽 1 张牌。',
    activeName: '全国动员', activeDesc: '消耗 4 CP，总部恢复 5 点血量。',
    activeCost: 4, activeCooldown: 0,
    onTurnStart: (game, player) => { if(player.hqHp < 10) player.drawCard(1); },
    useActive: (game, player) => { player.hqHp = Math.min(25, player.hqHp + 5); }
  }
];
// 修正巴顿被动
COMMANDERS_DATA[2].passiveDesc = '每回合开始时，随机使我方一个单位攻击力+1。';
COMMANDERS_DATA[2].onTurnStart = (game, player) => { if(player.board.length > 0) { const target = player.board[Math.floor(Math.random() * player.board.length)]; target.attack += 1; } };

// --- 环境卡数据 ---
export const ENVIRONMENT_CARDS_DATA: Omit<EnvironmentCard, 'id' | 'faction'>[] = [
  {
    name: '凛冬严寒', description: '环境卡：每回合开始时，所有前线单位受到 1 点伤害。', type: CardType.ENVIRONMENT, deployCost: 4,
    onPlay: (game) => {},
    onTurnStart: (game) => {
      game.player1.board.filter((u: UnitCard) => u.line === 'frontline').forEach((u: UnitCard) => u.hp -= 1);
      game.player2.board.filter((u: UnitCard) => u.line === 'frontline').forEach((u: UnitCard) => u.hp -= 1);
      game.player1.board = game.player1.board.filter((u: UnitCard) => u.hp > 0);
      game.player2.board = game.player2.board.filter((u: UnitCard) => u.hp > 0);
    }
  },
  {
    name: '泥泞泥土 (Rasputitsa)', description: '环境卡：所有装甲单位移动到前线的 CP 消耗增加 1 点。', type: CardType.ENVIRONMENT, deployCost: 3,
    onPlay: (game) => {
      game.player1.board.filter((u: UnitCard) => u.category === UnitCategory.ARMOR).forEach((u: UnitCard) => u.moveCost += 1);
      game.player2.board.filter((u: UnitCard) => u.category === UnitCategory.ARMOR).forEach((u: UnitCard) => u.moveCost += 1);
    },
    onTurnStart: (game) => {}
  },
  {
    name: '城市巷战', description: '环境卡：每回合开始时，所有步兵单位攻击力+1。', type: CardType.ENVIRONMENT, deployCost: 3,
    onPlay: (game) => {},
    onTurnStart: (game) => {
      game.player1.board.filter((u: UnitCard) => u.category === UnitCategory.INFANTRY).forEach((u: UnitCard) => u.attack += 1);
      game.player2.board.filter((u: UnitCard) => u.category === UnitCategory.INFANTRY).forEach((u: UnitCard) => u.attack += 1);
    }
  }
];

// --- 真实历史单位库 ---
export function getSovietUnits(): any[] {
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

export function getGermanUnits(): any[] {
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

export function getUSAUnits(): any[] {
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

export function getUKUnits(): any[] {
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

export function getFranceUnits(): any[] {
  return [
    { name: '外籍军团', cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 3, hp: 6, desc: '精锐的外籍军团士兵。', keywords: [Keyword.GUARD] },
    { name: 'S35 骑兵坦克', cat: UnitCategory.ARMOR, cost: 4, atk: 5, def: 5, hp: 7, desc: '机动性与装甲兼顾的优秀坦克。', keywords: [Keyword.BLITZ] },
    { name: 'B1 重型坦克', cat: UnitCategory.ARMOR, cost: 6, atk: 7, def: 7, hp: 9, desc: '战前欧洲最强坦克之一。', keywords: [Keyword.HEAVY_ARMOR] },
    { name: '自由法国游击队', cat: UnitCategory.INFANTRY, cost: 2, atk: 4, def: 1, hp: 3, desc: '在敌后进行破坏活动的抵抗力量。', keywords: [Keyword.AMBUSH] }
  ];
}

// --- 高级隐藏单位库 (通过军校解锁) ---
export const ADVANCED_CARDS_DATA = [
  { id: 'adv-soviet-1', name: '斯大林格勒近卫师', faction: Faction.SOVIET, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 7, atk: 10, def: 7, hp: 12, desc: '【高级】经历过最残酷巷战的钢铁部队。', keywords: [Keyword.GUARD, Keyword.AMBUSH, Keyword.HEAVY_ARMOR] },
  { id: 'adv-german-1', name: '虎王重型坦克', faction: Faction.GERMANY, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 10, atk: 14, def: 12, hp: 18, desc: '【高级】无敌的正面装甲，盟军装甲的终极噩梦。', keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD, Keyword.BLITZ] },
  { id: 'adv-usa-1', name: '101空降师 "啸鹰"', faction: Faction.USA, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 6, atk: 8, def: 5, hp: 8, desc: '【高级】"从天而降，包围敌军"！', keywords: [Keyword.BLITZ, Keyword.AMBUSH] },
  { id: 'adv-uk-1', name: 'SAS 特种空勤团', faction: Faction.UK, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 5, atk: 9, def: 4, hp: 7, desc: '【高级】"勇者必胜"，执行最高难度破坏任务。', keywords: [Keyword.BLITZ, Keyword.AMBUSH] },
  { id: 'adv-france-1', name: '自由法国装甲师', faction: Faction.FRANCE, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 8, atk: 10, def: 8, hp: 12, desc: '【高级】为光复祖国而战的精锐装甲力量。', keywords: [Keyword.BLITZ, Keyword.HEAVY_ARMOR] },
];

export const ADVANCED_ORDERS_DATA = [
  {
    id: 'adv-order-soviet', name: '朱可夫的决断', faction: Faction.SOVIET, type: CardType.ORDER, cost: 6, desc: '【高级指令】最高统帅部下达总攻命令！我方全军攻击力+5，血量+5。',
    effect: (game: Game) => { game.currentPlayer.board.forEach(u => { u.attack += 5; u.hp += 5; u.maxHp += 5; }); }
  },
  {
    id: 'adv-order-german', name: '古德里安的装甲矛头', faction: Faction.GERMANY, type: CardType.ORDER, cost: 6, desc: '【高级指令】突破极限！我方所有单位恢复行动，攻击力+3，并获得重甲。',
    effect: (game: Game) => { game.currentPlayer.board.forEach(u => { u.attack += 3; u.hasAttackedThisTurn = false; u.hasMovedThisTurn = false; if(!u.keywords.includes(Keyword.HEAVY_ARMOR)) u.keywords.push(Keyword.HEAVY_ARMOR); }); }
  },
  {
    id: 'adv-order-manhattan', name: '曼哈顿计划', faction: Faction.USA, type: CardType.ORDER, cost: 10, desc: '【高级指令】终极武器！对敌方总部直接造成 12 点毁灭性伤害。',
    effect: (game: Game) => { const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1; enemy.takeHqDamage(12); }
  },
];

// --- 真实历史背景指令卡 ---
export function createGenericOrders(faction: Faction): OrderCard[] {
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
    },
    {
      id: `${faction}-order-mine`, name: '工兵作业：地雷', description: '战术部署：在支援战线部署一个反坦克地雷（具备极高伏击伤害）。',
      type: CardType.ORDER, faction: faction, deployCost: 2,
      effect: (game: Game) => {
        const mine: UnitCard = {
          id: `${faction}-mine-${Math.random().toString(36).substring(7)}`, name: '反坦克地雷', description: '隐蔽的反坦克武器，伏击触发后造成毁灭性伤害。',
          type: CardType.UNIT, category: UnitCategory.INFANTRY, faction: faction,
          deployCost: 2, attack: 15, defense: 1, hp: 1, maxHp: 1, moveCost: 0,
          keywords: [Keyword.AMBUSH],
          hasMovedThisTurn: true, hasAttackedThisTurn: true, line: 'support'
        };
        game.currentPlayer.board.push(mine);
      }
    },
    {
      id: `${faction}-order-sandbag`, name: '工兵作业：掩体', description: '战术部署：在支援战线部署一个沙袋掩体（具备守护和高血量）。',
      type: CardType.ORDER, faction: faction, deployCost: 2,
      effect: (game: Game) => {
        const sandbag: UnitCard = {
          id: `${faction}-sandbag-${Math.random().toString(36).substring(7)}`, name: '沙袋掩体', description: '坚固的防御工事，吸引敌方火力。',
          type: CardType.UNIT, category: UnitCategory.INFANTRY, faction: faction,
          deployCost: 2, attack: 0, defense: 3, hp: 8, maxHp: 8, moveCost: 0,
          keywords: [Keyword.GUARD],
          hasMovedThisTurn: true, hasAttackedThisTurn: true, line: 'support'
        };
        game.currentPlayer.board.push(sandbag);
      }
    }
  ];
}

export function createSovietOrders(): OrderCard[] {
  return [
    {
      id: 'soviet-order-heal', name: '战地医院', description: '紧急救治！总部恢复 8 点血量。',
      type: CardType.ORDER, faction: Faction.SOVIET, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
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

export function createGermanOrders(): OrderCard[] {
  return [
    {
      id: 'german-order-heal', name: '野战急救', description: '紧急救治！总部恢复 8 点血量。',
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
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
      id: 'german-order-v1', name: 'V1飞弹', description: '初期巡航导弹。对敌方总部造成 4 点伤害。若敌方场上有空军单位，则有 50% 概率被拦截（无伤害）。',
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 3,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        const hasAirForce = enemy.board.some(u => u.category === UnitCategory.AIR_FORCE);
        if (hasAirForce && Math.random() < 0.5) {
          game.addLog(enemy.name, `敌方战斗机成功拦截了 V1飞弹！`, 'system');
        } else {
          enemy.takeHqDamage(4);
        }
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

export function createUSAOrders(): OrderCard[] {
  return [
    {
      id: 'usa-order-heal', name: '医疗物资空投', description: '紧急救治！总部恢复 8 点血量。',
      type: CardType.ORDER, faction: Faction.USA, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
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

export function createUKOrders(): OrderCard[] {
  return [
    {
      id: 'uk-order-heal', name: '红十字会', description: '紧急救治！总部恢复 8 点血量。',
      type: CardType.ORDER, faction: Faction.UK, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
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

export function createFranceOrders(): OrderCard[] {
  return [
    {
      id: 'france-order-heal', name: '自由法国医疗队', description: '紧急救治！总部恢复 8 点血量。',
      type: CardType.ORDER, faction: Faction.FRANCE, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
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

export function buildDeck(faction: Faction, customCounts?: Record<string, number>): any[] {
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

  // 检查是否有自定义卡组
  try {
      const counts = customCounts || JSON.parse(localStorage.getItem('customDecks') || '{}')[faction];
      if (counts) {
          // 将所有单元补充上统一ID，供匹配
          const allUnits = factionUnits.map(u => ({ ...u, id: `${faction}-unit-${u.name}`, type: CardType.UNIT, category: u.cat, deployCost: u.cost, attack: u.atk, defense: u.def, hp: u.hp, maxHp: u.hp, moveCost: 1, keywords: u.keywords || [], line: 'support', hasMovedThisTurn: false, hasAttackedThisTurn: false }));
          const allAdvUnits = myAdvancedUnits.map(c => ({...c, cat: c.cat, cost: c.cost, atk: c.atk, def: c.def, isAdvanced: true, line: 'support', hasMovedThisTurn: false, hasAttackedThisTurn: false}));
          const allAdvOrders = myAdvancedOrders.map(c => ({...c, isAdvanced: true}));
          const allEnvs = ENVIRONMENT_CARDS_DATA.map(e => ({...e, id: `env-${e.name}`, faction}));
          const allPool = [...allUnits, ...allAdvUnits, ...factionOrders, ...allAdvOrders, ...allEnvs];

          let cardIndex = 1;
          Object.entries(counts).forEach(([templateId, count]) => {
              const cardTemplate = allPool.find(c => c.id === templateId || c.name === templateId);
              if (cardTemplate) {
                  for(let i=0; i<(count as number); i++) {
                      deck.push({...cardTemplate, id: `${cardTemplate.id}-${cardIndex++}`});
                  }
              }
          });

          // 如果不够60张，走下面随机补全逻辑
          if (deck.length >= 60) return deck;
      }
  } catch(e) {}

  for (let i = deck.length + 1; i <= 60; i++) {
    // 随机塞入环境卡
    if (i === 15 || i === 45) {
      const randomEnv = ENVIRONMENT_CARDS_DATA[Math.floor(Math.random() * ENVIRONMENT_CARDS_DATA.length)];
      deck.push({ ...randomEnv, id: `env-${i}`, faction: faction } as EnvironmentCard);
      continue;
    }

    // 每30张牌尝试随机塞入一张高级牌（也就是一副60张的牌库最多只有2张高级牌，保证稀有度）
    if (i % 30 === 0 && (myAdvancedUnits.length > 0 || myAdvancedOrders.length > 0)) {
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
      let randomOrder;
      // 对于德国阵营，降低 V2 火箭的抽取概率
      if (faction === Faction.GERMANY) {
         // 生成 0-99 的随机数，如果小于 5（5%概率）才可能抽到 V2 火箭
         const roll = Math.random() * 100;
         if (roll < 5) {
             randomOrder = factionOrders.find(o => o.id === 'german-order-v2');
         }
         // 如果没抽到或者没找到 V2 火箭，则在剩下的指令卡中随机抽
         if (!randomOrder) {
             const otherOrders = factionOrders.filter(o => o.id !== 'german-order-v2');
             randomOrder = otherOrders[Math.floor(Math.random() * otherOrders.length)];
         }
      } else {
         randomOrder = factionOrders[Math.floor(Math.random() * factionOrders.length)];
      }
      
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

// --- 战役模式数据 ---
export const CAMPAIGN_SCENARIOS: CampaignScenario[] = [
  {
    id: 'campaign-normandy',
    name: '诺曼底登陆 (奥马哈海滩)',
    description: '1944年6月6日。盟军在诺曼底登陆。德军在悬崖上部署了坚固的暗堡。\n目标：在 15 回合内突破大西洋壁垒，摧毁德军指挥部！\n奖励：解锁高级卡牌【101空降师】',
    playerFaction: Faction.USA,
    aiFaction: Faction.GERMANY,
    maxTurns: 15,
    rewardCardId: 'adv-usa-1',
    setupBoard: (game: Game) => {
      // 史诗级削弱：德军前线部署 2 个暗堡 (原为3个)
      for(let i=0; i<2; i++) {
        const bunker: UnitCard = {
          id: `bunker-${i}`, name: '大西洋壁垒暗堡', description: '坚固的混凝土工事，无法攻击。',
          type: CardType.UNIT, category: UnitCategory.INFANTRY, faction: Faction.GERMANY,
          deployCost: 0, attack: 0, defense: 5, hp: 10, maxHp: 10, moveCost: 0,
          keywords: [Keyword.GUARD], // 移除重甲，削弱血防，移除攻击力
          hasMovedThisTurn: true, hasAttackedThisTurn: true, line: 'frontline'
        };
        game.player2.board.push(bunker);
      }
      game.player2.hqHp = 30; // 德军指挥部血量从 40 下调至 30
      game.player1.cp = 2;    // 玩家获得抢滩登陆支援：初始自带 2 点 CP
    }
  },
  {
    id: 'campaign-stalingrad',
    name: '斯大林格勒保卫战',
    description: '1942年冬。德军第6集团军大举进攻。城市化为废墟，环境极其恶劣。\n目标：在 20 回合内击溃德军指挥部。\n奖励：解锁高级卡牌【斯大林格勒近卫师】',
    playerFaction: Faction.SOVIET,
    aiFaction: Faction.GERMANY,
    maxTurns: 20,
    rewardCardId: 'adv-soviet-1',
    setupBoard: (game: Game) => {
      game.activeEnvironment = ENVIRONMENT_CARDS_DATA.find(e => e.name === '城市巷战') as EnvironmentCard;
      // 史诗级削弱：移除开局两辆贴脸的四号坦克，改为两支在支援战线的普通步兵
      for(let i=0; i<2; i++) {
         const infantry: UnitCard = {
           id: `inf-${i}`, name: '国防军步兵', description: '进入废墟的德军步兵。',
           type: CardType.UNIT, category: UnitCategory.INFANTRY, faction: Faction.GERMANY,
           deployCost: 0, attack: 4, defense: 4, hp: 5, maxHp: 5, moveCost: 1,
           keywords: [],
           hasMovedThisTurn: true, hasAttackedThisTurn: true, line: 'support'
         };
         game.player2.board.push(infantry);
      }
      game.player2.hqHp = 25; // 恢复正常血量 25 (原为 30)
      game.player1.cp = 2;    // 玩家获得政委支援：初始自带 2 点 CP
    }
  },
  {
    id: 'campaign-kursk',
    name: '库尔斯克会战 (钢铁对决)',
    description: '1943年夏。史上最大规模的坦克会战。双方指挥部将获得大量初始指挥点，但只有装甲部队能发挥最大效用。\n目标：在 15 回合内击溃敌方指挥部。\n奖励：解锁高级卡牌【虎王重型坦克】',
    playerFaction: Faction.SOVIET,
    aiFaction: Faction.GERMANY,
    maxTurns: 15,
    rewardCardId: 'adv-german-1', // Actually it's unlocked for player, maybe they play as Germany? Let's keep Soviet and give them German tank? No, let's make player Germany for this one.
    setupBoard: (game: Game) => {
      // 双方初始10CP，但这只是当前回合的CP，为了让后续回合也保持10CP上限，需要修改 maxCp
      game.player1.maxCp = 10;
      game.player1.cp = 10;
      game.player2.maxCp = 10;
      game.player2.cp = 10;
      // 移除步兵，只保留装甲（简化的特殊规则）
      game.activeEnvironment = {
          name: '钢铁洪流', description: '环境卡：所有步兵单位入场时立即受到 5 点伤害。', type: CardType.ENVIRONMENT, deployCost: 0, faction: Faction.GERMANY, id: 'env-kursk',
          onPlay: (g: Game) => {},
          onTurnStart: (g: Game) => {
              g.player1.board.filter((u: UnitCard) => u.category === UnitCategory.INFANTRY).forEach((u: UnitCard) => u.hp -= 5);
              g.player2.board.filter((u: UnitCard) => u.category === UnitCategory.INFANTRY).forEach((u: UnitCard) => u.hp -= 5);
              g.player1.board = g.player1.board.filter((u: UnitCard) => u.hp > 0);
              g.player2.board = g.player2.board.filter((u: UnitCard) => u.hp > 0);
          }
      };
    }
  },
  {
    id: 'campaign-britain',
    name: '不列颠空战',
    description: '1940年秋。德国空军对英国本土进行大规模轰炸，皇家空军奋起反击。争夺制空权！\n目标：在 15 回合内守住指挥部并击溃敌方。\n奖励：解锁高级卡牌【SAS 特种空勤团】',
    playerFaction: Faction.UK,
    aiFaction: Faction.GERMANY,
    maxTurns: 15,
    rewardCardId: 'adv-uk-1',
    setupBoard: (game: Game) => {
      game.activeEnvironment = {
          name: '制空权争夺', description: '环境卡：所有空军单位攻击力+2。', type: CardType.ENVIRONMENT, deployCost: 0, faction: Faction.UK, id: 'env-britain',
          onPlay: (g: Game) => {},
          onTurnStart: (g: Game) => {}
      };
      // 为所有场上空军+2攻
      game.player1.board.filter((u: UnitCard) => u.category === UnitCategory.AIR_FORCE).forEach((u: UnitCard) => u.attack += 2);
      game.player2.board.filter((u: UnitCard) => u.category === UnitCategory.AIR_FORCE).forEach((u: UnitCard) => u.attack += 2);
    }
  }
];

export default function App() {
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>('lobby');
  const [playerFaction, setPlayerFaction] = useState<Faction>(Faction.SOVIET);
  const [aiFaction, setAiFaction] = useState<Faction>(Faction.GERMANY);
  
  const [gameMode, setGameMode] = useState<'ai' | 'multiplayer' | 'campaign'>('ai');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>('campaign-normandy');
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [remoteState, setRemoteState] = useState<any>(null);

  const [game, setGame] = useState<Game | null>(null);
  const [, setTick] = useState(0);
  const isAITurnRunning = useRef(false);

  const [showTutorial, setShowTutorial] = useState(false);
  const [showAcademy, setShowAcademy] = useState(false);
  const [showDeckBuilder, setShowDeckBuilder] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const forceUpdate = () => setTick(t => t + 1);

  // 交互状态
  const [selectedBoardUnit, setSelectedBoardUnit] = useState<{player: 'p1'|'p2', index: number} | null>(null);

  // 动画状态
  const [hiddenHandIndex, setHiddenHandIndex] = useState<number | null>(null);
  const [playingAnim, setPlayingAnim] = useState<{ card: BaseCard; index: number; status: 'hover' | 'slam' | 'slide'; statsSum: number; player: 'p1' | 'p2' } | null>(null);
  const [attackAnim, setAttackAnim] = useState<{ attackerId: string, defenderId: string, phase: 'windup' | 'strike' } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [globalShake, setGlobalShake] = useState(0);
  const [flash, setFlash] = useState<'red' | 'white' | 'gold' | null>(null);
  const [turnBanner, setTurnBanner] = useState<string | null>(null);
  const [orderVfx, setOrderVfx] = useState<{ type: 'explosions' | 'nuke' | 'buff' | 'advanced', area: 'p1-support' | 'p2-support' | 'p1-hq' | 'p2-hq' | 'p1-board' | 'p2-board' | 'p1-frontline' | 'p2-frontline' | 'global' } | null>(null);
  const [transientVfx, setTransientVfx] = useState<Array<{ id: string, type: 'damage' | 'heal' | 'armor' | 'death', text?: string, x: number, y: number, color?: string }>>([]);

  const executeAttackRef = useRef<any>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const spawnTransientVfx = (type: 'damage' | 'heal' | 'armor' | 'death', text: string, targetId: string) => {
    const elId = targetId.includes('-hq') ? targetId : `card-${targetId}`;
    const el = document.getElementById(elId);
    if (el) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const id = Math.random().toString(36).substring(7);
      
      // Randomize position slightly for floating text
      const offsetX = type === 'death' ? 0 : (Math.random() - 0.5) * 40;
      const offsetY = type === 'death' ? 0 : (Math.random() - 0.5) * 40;

      setTransientVfx(prev => [...prev, { id, type, text, x: x + offsetX, y: y + offsetY }]);
      setTimeout(() => {
        setTransientVfx(prev => prev.filter(v => v.id !== id));
      }, type === 'death' ? 1000 : 1500);
    }
  };

  const startGame = () => {
    let p1Fac = playerFaction;
    let p2Fac = aiFaction;
    const isCampaign = gameMode === 'campaign' && selectedCampaign;
    const scenario = isCampaign ? CAMPAIGN_SCENARIOS.find(c => c.id === selectedCampaign) : null;

    if (isCampaign && scenario) {
      p1Fac = scenario.playerFaction;
      p2Fac = scenario.aiFaction;
      setPlayerFaction(p1Fac);
      setAiFaction(p2Fac);
    }

    const p1 = new Player("指挥官 (我方)", p1Fac, buildDeck(p1Fac));
    p1.commander = COMMANDERS_DATA.find(c => c.faction === p1Fac) || null;
    
    let p2Deck = buildDeck(p2Fac);
    if (gameMode === 'multiplayer' && isHost && (window as any).guestDeckCounts) {
        p2Deck = buildDeck(p2Fac, (window as any).guestDeckCounts);
    }
    
    const p2 = new Player(gameMode === 'ai' || isCampaign ? "AI 指挥官 (敌方)" : "敌方指挥官", p2Fac, p2Deck);
    p2.commander = COMMANDERS_DATA.find(c => c.faction === p2Fac) || null;
    const newGame = new Game(p1, p2);

    if (isCampaign && scenario) {
      newGame.maxTurns = scenario.maxTurns;
      scenario.setupBoard(newGame);
    }

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
      } else {
        // Guest joins, send their custom deck config
        let deckCounts = {};
        try {
           deckCounts = JSON.parse(localStorage.getItem('customDecks') || '{}')[playerFaction] || {};
        } catch(e) {}
        networkManager.send({ type: 'GUEST_READY', faction: playerFaction, deckCounts });
      }
    };

    networkManager.onDataCb = (data: NetworkAction) => {
      if (data.type === 'GUEST_READY' && networkManager.isHost) {
          setAiFaction(data.faction as Faction);
          setConnectionStatus(`已连接！对手阵营: ${data.faction}`);
          // We will apply this deck config when startGame is clicked
          (window as any).guestDeckCounts = data.deckCounts; 
          networkManager.send({ type: 'HOST_INFO', faction: playerFaction });
      } else if (data.type === 'HOST_INFO' && !networkManager.isHost) {
          setAiFaction(data.faction as Faction);
          setConnectionStatus(`已连接！对手阵营: ${data.faction}`);
      } else if (data.type === 'SYNC_STATE') {
        console.log('Received SYNC_STATE', data.state);
        if (!networkManager.isHost && game) {
           try {
             game.deserialize(data.state, false);
             console.log('Guest game after deserialize (direct):', game);
             forceUpdate();
           } catch(e) {
             console.error("Guest deserialize error:", e);
           }
        } else {
           setRemoteState(data.state);
        }
        if (gamePhase === 'lobby') setGamePhase('playing');
      } else if (data.type === 'GAME_START') {
        setPlayerFaction(data.p2Faction as Faction);
        setAiFaction(data.p1Faction as Faction);
        
        // 客机收到游戏开始指令，初始化本地 Game 对象用于渲染
        const p1 = new Player("指挥官 (我方)", data.p2Faction as Faction, buildDeck(data.p2Faction as Faction));
        p1.commander = COMMANDERS_DATA.find(c => c.faction === data.p2Faction) || null;
        
        const p2 = new Player("敌方指挥官", data.p1Faction as Faction, []);
        p2.commander = COMMANDERS_DATA.find(c => c.faction === data.p1Faction) || null;
        
        const newGame = new Game(p1, p2);
        setGame(newGame);
        setGamePhase('playing');
      } else if (data.type === 'VFX') {
        const localIsP1 = networkManager.isHost ? data.isP1 : !data.isP1;
        playOrderVFX(data.cardId, localIsP1);
      } else if (data.type === 'START_PLAY_ANIM') {
        const localIsP1 = networkManager.isHost ? data.isP1 : !data.isP1;
        runPlayAnim(localIsP1 ? 'p1' : 'p2', data.index, data.card);
      } else if (data.type === 'START_ATTACK_ANIM') {
        const localIsP1 = networkManager.isHost ? data.isP1 : !data.isP1;
        let finalDefId = data.defenderId;
        // Invert HQ ids if necessary
        if (!networkManager.isHost) {
           if (finalDefId === 'p1-hq') finalDefId = 'p2-hq';
           else if (finalDefId === 'p2-hq') finalDefId = 'p1-hq';
        }
        setAttackAnim({ attackerId: data.attackerId, defenderId: finalDefId, phase: 'windup' });
        setTimeout(() => {
           setAttackAnim({ attackerId: data.attackerId, defenderId: finalDefId, phase: 'strike' });
           setTimeout(() => {
              setAttackAnim(null);
           }, 100);
        }, 300);
      } else if (data.type === 'SPAWN_TRANSIENT_VFX') {
        const localIsP1 = networkManager.isHost ? data.isP1 : !data.isP1;
        let finalTargetId = data.targetId;
        if (!networkManager.isHost) {
           if (finalTargetId === 'p1-hq') finalTargetId = 'p2-hq';
           else if (finalTargetId === 'p2-hq') finalTargetId = 'p1-hq';
        }
        spawnTransientVfx(data.vfxType, data.text, finalTargetId);
      }
      
      // If we are host, process incoming actions from client
      if (networkManager.isHost && game) {
        if (data.type === 'END_TURN') {
          game.nextTurn();
        } else if (data.type === 'PLAY_CARD') {
          const card = game.player2.hand[data.index];
          if (card) {
            networkManager.send({ type: 'START_PLAY_ANIM', index: data.index, isP1: false, card });
            runPlayAnim('p2', data.index, card).then(() => {
              game.player2.playCard(data.index, game);
              forceUpdate();
              try {
                networkManager.send({ type: 'SYNC_STATE', state: game.serialize() });
              } catch (e) {
                console.error("Host serialize error in onDataCb:", e);
              }
              if (card.type === CardType.ORDER || card.isAdvanced) {
                playOrderVFX(card.id, false);
                networkManager.send({ type: 'VFX', cardId: card.id, isP1: false });
              }
            });
            return; // Skip the global forceUpdate and SYNC_STATE below
          }
        } else if (data.type === 'MOVE_UNIT') {
          game.moveUnit(game.player2, game.player1, game.player2.board[data.index]);
        } else if (data.type === 'ATTACK_UNIT') {
          if (executeAttackRef.current) {
            executeAttackRef.current(game.player2.board[data.attackerIndex], game.player1.board[data.defenderIndex], game.player2, game.player1, false);
            return;
          }
        } else if (data.type === 'ATTACK_HQ') {
          if (executeAttackRef.current) {
            executeAttackRef.current(game.player2.board[data.attackerIndex], 'hq', game.player2, game.player1, false);
            return;
          }
        } else if (data.type === 'USE_SKILL') {
          if (game.player2.cp >= game.player2.commander!.activeCost) {
            game.player2.cp -= game.player2.commander!.activeCost;
            game.player2.commander!.useActive(game, game.player2);
            game.addLog(game.player2.name, `消耗 ${game.player2.commander!.activeCost} CP 释放了主动技能 [${game.player2.commander!.activeName}]！`, 'skill');
            // 简单处理特效，触发一个全局的
            playOrderVFX('cmd-skill', false);
            networkManager.send({ type: 'VFX', cardId: 'cmd-skill', isP1: false });
          }
        }
        forceUpdate();
        try {
          networkManager.send({ type: 'SYNC_STATE', state: game.serialize() });
        } catch (e) {
          console.error("Host serialize error in onDataCb:", e);
        }
      }
    };

  }, [gameMode, game, gamePhase]);

  // 客机同步状态逻辑 (Fallback for the first sync or missed updates)
  useEffect(() => {
    if (gameMode === 'multiplayer' && !networkManager.isHost && remoteState && game) {
      console.log('Guest received remoteState (fallback):', remoteState);
      try {
        game.deserialize(remoteState, false); // 传入 isHost=false，启用状态反转映射
        console.log('Guest game after deserialize (fallback):', game);
        forceUpdate();
      } catch(e) {
        console.error("Guest deserialize error (fallback):", e);
      }
      setRemoteState(null); // Clear to avoid re-running
    }
  }, [remoteState, game, gameMode]);

  useEffect(() => {
    if (!game || gamePhase !== 'playing' || gameMode === 'multiplayer') return;
    const p1 = game.player1;
    const p2 = game.player2;

    if (game.currentPlayer === p2 && !isAITurnRunning.current) {
      isAITurnRunning.current = true;
      const playAITurn = async () => {
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        await sleep(1000);

        // 0. AI 判断是否使用指挥官技能
        if (p2.commander && p2.cp >= p2.commander.activeCost && (!p2.commander.currentCooldown || p2.commander.currentCooldown <= 0)) {
          const shouldUse = Math.random() > 0.5; // 50%概率使用
          if (shouldUse) {
             p2.cp -= p2.commander.activeCost;
             p2.commander.currentCooldown = p2.commander.activeCooldown;
             p2.commander.useActive(game, p2);
             game.addLog(p2.name, `消耗 ${p2.commander.activeCost} CP 使用了指挥官技能 [${p2.commander.activeName}]。`, 'skill');
             forceUpdate();
             setOrderVfx({ type: 'buff', area: 'p2-hq' });
             await sleep(1000);
             setOrderVfx(null);
          }
        }

        // 1. AI 部署卡牌
        let canPlay = true;
        while (canPlay && !game.isGameOver) {
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
            
            if (cardToPlay.type === CardType.ORDER || cardToPlay.isAdvanced) {
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
            if (executeAttackRef.current) await executeAttackRef.current(unit, target, p2, p1, false);
          } else {
            // Check if can attack HQ
            const guards = p1.board.filter(u => u.keywords.includes(Keyword.GUARD));
            const canAtkHq = (unit.category === UnitCategory.ARTILLERY || unit.category === UnitCategory.AIR_FORCE) || (unit.line === 'frontline');
            if (guards.length === 0 && canAtkHq) {
                if (executeAttackRef.current) await executeAttackRef.current(unit, 'hq', p2, p1, false);
            }
          }
          forceUpdate();
          await sleep(500);
        }

        await sleep(500);
        isAITurnRunning.current = false;
        if (!game.isGameOver) handleEndTurn();
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

  // 自动滚动日志
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [game?.logs.length, showLogs]);

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
          <button 
            onClick={() => setShowDeckBuilder(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transition-colors border-2 border-purple-400"
          >
            🛠️ 自定义卡组 (Deck Builder)
          </button>
        </div>

        <h1 className="text-6xl font-black mb-8 tracking-widest text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">二战卡牌风云</h1>
        
        <div className="flex gap-4 mb-8">
          <button onClick={() => setGameMode('ai')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'ai' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>单人 (VS AI)</button>
          <button onClick={() => setGameMode('campaign')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'campaign' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>历史战役 (PVE)</button>
          <button onClick={() => setGameMode('multiplayer')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'multiplayer' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>联机对战</button>
        </div>

        <div className="flex gap-16 bg-black/50 p-12 rounded-2xl border-4 border-gray-700 shadow-2xl relative w-full max-w-5xl justify-center">
          {gameMode === 'campaign' ? (
            <div className="flex flex-col gap-4 w-full">
              <h2 className="text-2xl font-bold mb-4 text-center">选择历史战役</h2>
              <div className="grid grid-cols-2 gap-6">
                {CAMPAIGN_SCENARIOS.map(sc => (
                  <button key={sc.id} onClick={() => setSelectedCampaign(sc.id)} className={`p-6 rounded-xl text-left transition-all flex flex-col gap-3 ${selectedCampaign === sc.id ? 'bg-red-900/80 border-2 border-red-500 shadow-[0_0_15px_red] scale-105' : 'bg-gray-800 border-2 border-gray-700 hover:bg-gray-700'}`}>
                    <h3 className="text-2xl font-black text-amber-500">{sc.name}</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{sc.description}</p>
                    <div className="mt-auto pt-4 border-t border-gray-600 flex justify-between text-xs font-bold text-gray-400">
                       <span>我方: {sc.playerFaction}</span>
                       <span>敌方: {sc.aiFaction}</span>
                       <span>限时: {sc.maxTurns} 回合</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        {(gameMode === 'ai' || gameMode === 'campaign' || (gameMode === 'multiplayer' && isHost && connectionStatus.startsWith('已连接！'))) && (
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

        <AnimatePresence>
          {showDeckBuilder && <DeckBuilder onClose={() => setShowDeckBuilder(false)} />}
        </AnimatePresence>
      </div>
    );
  }

  if (!game) return null;

  const p1 = game.player1;
  const p2 = game.player2;

  const playOrderVFX = async (cardId: string, isP1: boolean) => {
    if (cardId.includes('adv-')) {
      setOrderVfx({ type: 'advanced', area: 'global' });
      setFlash('gold');
      setGlobalShake(40);
      await new Promise(r => setTimeout(r, 600));
    }

    if (cardId.includes('katyusha') || cardId.includes('carpet')) {
      setOrderVfx({ type: 'explosions', area: isP1 ? 'p2-support' : 'p1-support' });
      setGlobalShake(20);
      setFlash('red');
    } else if (cardId.includes('v2') || cardId.includes('manhattan')) {
      setOrderVfx({ type: 'nuke', area: isP1 ? 'p2-hq' : 'p1-hq' });
      setGlobalShake(50);
      setFlash('white');
    } else if (cardId.includes('ura') || cardId.includes('blitzkrieg') || cardId.includes('radar') || cardId.includes('maginot') || cardId.includes('adv-order')) {
      setOrderVfx({ type: 'buff', area: isP1 ? 'p1-board' : 'p2-board' });
    } else if (cardId.includes('navy')) {
      setOrderVfx({ type: 'explosions', area: isP1 ? 'p2-board' : 'p1-board' });
      setGlobalShake(25);
    } else if (cardId.includes('resistance') || cardId.includes('order-2')) {
      setOrderVfx({ type: 'explosions', area: isP1 ? 'p2-board' : 'p1-board' });
      setGlobalShake(15);
    } else if (cardId.includes('logistics') || cardId.includes('order-1') || cardId.includes('heal')) {
      setOrderVfx({ type: 'buff', area: isP1 ? 'p1-hq' : 'p2-hq' });
    } else if (cardId === 'cmd-skill') {
      setOrderVfx({ type: 'buff', area: isP1 ? 'p1-board' : 'p2-board' });
      setFlash('gold');
      setGlobalShake(10);
    }
    
    await new Promise(r => setTimeout(r, 1200));
    setOrderVfx(null);
    setGlobalShake(0);
    setFlash(null);
  };

  const executeAttack = async (attacker: UnitCard, defender: UnitCard | 'hq', pAtk: Player, pDef: Player, isLocalP1: boolean = true) => {
    const defId = typeof defender === 'string' ? (pDef === p2 ? 'p2-hq' : 'p1-hq') : defender.id;
    
    if (gameMode === 'multiplayer' && isHost) {
       networkManager.send({ type: 'START_ATTACK_ANIM', attackerId: attacker.id, defenderId: defId, isP1: isLocalP1 });
    }

    setAttackAnim({ attackerId: attacker.id, defenderId: defId, phase: 'windup' });
    await new Promise(r => setTimeout(r, 300));
    setAttackAnim({ attackerId: attacker.id, defenderId: defId, phase: 'strike' });
    await new Promise(r => setTimeout(r, 100));

    const atkHpBefore = attacker.hp;
    const defHpBefore = typeof defender === 'string' ? pDef.hqHp : defender.hp;

    let success = false;
    if (typeof defender === 'string') {
      success = game.attackHQ(attacker, pDef);
      if (success) setFlash('red');
    } else {
      success = game.attackUnit(attacker, defender, pAtk, pDef);
    }
    
    if (success) {
      const atkHpAfter = attacker.hp;
      const defHpAfter = typeof defender === 'string' ? pDef.hqHp : (defender as UnitCard).hp;
      
      const atkDamage = atkHpBefore - atkHpAfter;
      const defDamage = defHpBefore - defHpAfter;

      const spawnAndSyncVfx = (type: 'damage' | 'heal' | 'armor' | 'death', text: string, targetId: string) => {
         spawnTransientVfx(type, text, targetId);
         if (gameMode === 'multiplayer' && isHost) {
            networkManager.send({ type: 'SPAWN_TRANSIENT_VFX', vfxType: type, text, targetId, isP1: isLocalP1 });
         }
      };

      if (defDamage > 0) {
        spawnAndSyncVfx('damage', `-${defDamage}`, defId);
      } else if (defDamage === 0 && typeof defender !== 'string' && defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
        spawnAndSyncVfx('armor', '格挡', defId);
      }
      
      if (atkDamage > 0) {
        spawnAndSyncVfx('damage', `-${atkDamage}`, attacker.id);
      }

      if (defHpAfter <= 0 && typeof defender !== 'string') {
        spawnAndSyncVfx('death', '', defId);
      }
      if (atkHpAfter <= 0) {
        spawnAndSyncVfx('death', '', attacker.id);
      }
    }

    setGlobalShake(attacker.attack * (typeof defender === 'string' ? 4 : 2) + 10);
    forceUpdate();
    await new Promise(r => setTimeout(r, 400));
    setGlobalShake(0);
    setFlash(null);
    setAttackAnim(null);
    if (gameMode === 'multiplayer' && isHost) {
      networkManager.send({ type: 'SYNC_STATE', state: game!.serialize() });
    }
  };
  executeAttackRef.current = executeAttack;

  const runPlayAnim = async (player: 'p1' | 'p2', index: number, card: BaseCard) => {
    if (player === 'p1') {
      setHiddenHandIndex(index);
    }
    const isUnit = card.type === CardType.UNIT;
    let statsSum = isUnit ? card.deployCost + ((card as any).attack || 0) + ((card as any).hp || 0) : card.deployCost * 2;

    setPlayingAnim({ card, index, status: 'hover', statsSum, player });
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

    setPlayingAnim(null);
    if (player === 'p1') {
      setHiddenHandIndex(null);
    }
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
      if (gameMode === 'multiplayer' && isHost) {
         networkManager.send({ type: 'START_PLAY_ANIM', index, isP1: true, card });
      }
      await runPlayAnim('p1', index, card);

      const success = p1.playCard(index, game);
      if (success) {
        forceUpdate();
        if (gameMode === 'multiplayer' && isHost) {
          networkManager.send({ type: 'SYNC_STATE', state: game!.serialize() });
        }
        if (card.type === CardType.ORDER || card.isAdvanced) {
          if (gameMode === 'multiplayer' && isHost) {
            networkManager.send({ type: 'VFX', cardId: card.id, isP1: true });
          }
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
      try {
        networkManager.send({ type: 'SYNC_STATE', state: game!.serialize() });
      } catch (e) {
        console.error("Host serialize error in handleEndTurn:", e);
      }
    }
  };

  // 攻击或移动验证
  const handleBoardUnitClick = async (owner: 'p1' | 'p2', index: number) => {
    if (gameMode === 'multiplayer' && !isHost) {
      if (owner === 'p1') {
        if (selectedBoardUnit?.player === 'p1' && selectedBoardUnit.index === index) {
          setSelectedBoardUnit(null);
        } else {
          setSelectedBoardUnit({ player: 'p1', index });
        }
      } else if (owner === 'p2' && selectedBoardUnit?.player === 'p1') {
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
      if (selectedBoardUnit?.player === 'p1') {
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
      if (selectedBoardUnit?.player === 'p1') {
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
         if (gameMode === 'multiplayer' && isHost) {
           networkManager.send({ type: 'SYNC_STATE', state: game!.serialize() });
         }
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans overflow-x-hidden overflow-y-auto relative">
      {/* 侧边对战记录栏 */}
      <div className={`fixed right-0 top-0 bottom-0 w-80 bg-gray-900 border-l-4 border-gray-700 shadow-[-10px_0_30px_rgba(0,0,0,0.8)] z-[250] transition-transform duration-300 flex flex-col ${showLogs ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="bg-gray-800 p-4 border-b-2 border-gray-700 flex justify-between items-center">
          <h3 className="font-bold text-lg text-amber-500 flex items-center gap-2">📜 对战日志</h3>
          <button onClick={() => setShowLogs(false)} className="text-gray-400 hover:text-white font-bold text-xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {game?.logs.map(log => (
            <div key={log.id} className="text-sm border-b border-gray-800 pb-2">
              <div className="flex justify-between items-center mb-1 opacity-70 text-xs">
                <span className={`font-bold ${log.playerName === p1?.name ? 'text-blue-400' : log.playerName === '系统' || log.playerName === '全局' ? 'text-gray-400' : 'text-red-400'}`}>{log.playerName}</span>
                <span>T{log.turn}</span>
              </div>
              <div className={`
                ${log.type === 'attack' ? 'text-red-300' : ''}
                ${log.type === 'play' ? 'text-green-300' : ''}
                ${log.type === 'skill' ? 'text-purple-300' : ''}
                ${log.type === 'environment' ? 'text-amber-300' : ''}
                ${log.type === 'system' ? 'text-gray-400 italic' : ''}
              `}>{log.message}</div>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

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
            className={`fixed inset-0 pointer-events-none z-[150] mix-blend-overlay ${flash === 'red' ? 'bg-[radial-gradient(circle,transparent_20%,#7f1d1d_100%)]' : flash === 'gold' ? 'bg-[radial-gradient(circle,transparent_20%,#ca8a04_100%)]' : 'bg-white'}`}
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

      <AnimatePresence>
        {orderVfx && orderVfx.type === 'advanced' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
            animate={{ opacity: [0, 1, 0.8, 0], scale: [0.5, 1.2, 1.5, 2], rotate: 0 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center mix-blend-screen"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(250,204,21,0.5)_0%,transparent_70%)]" />
            <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-600 drop-shadow-[0_0_20px_rgba(250,204,21,1)] tracking-widest uppercase italic">
              高级部署
            </h1>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 环境卡显示 */}
      <AnimatePresence>
        {game.activeEnvironment && (
          <motion.div
            initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            className="fixed top-1/2 right-4 -translate-y-1/2 z-50 bg-black/80 border-2 border-amber-600 rounded-lg p-4 w-64 shadow-2xl flex flex-col items-center pointer-events-none"
          >
            <div className="text-amber-500 font-bold mb-2 flex items-center gap-2">
              <span>🌍 当前环境</span>
            </div>
            <h3 className="text-lg font-black text-white">{game.activeEnvironment.name}</h3>
            <p className="text-xs text-gray-300 mt-2 text-center">{game.activeEnvironment.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div animate={attackAnim?.defenderId === 'hq' && game.currentPlayer === p1 ? { x: [-10, 10, -10, 10, 0], backgroundColor: ['#1f2937', '#7f1d1d', '#1f2937'] } : {}}
        className="bg-gray-800 p-4 border-b-4 border-gray-700 flex justify-between items-center shadow-lg z-10 relative">
        <div className="flex items-center gap-4">
          {/* 敌方指挥官 */}
          {p2.commander && (
            <div className="w-16 h-16 bg-gray-900 rounded-full border-2 border-red-700 flex items-center justify-center flex-col shadow-lg overflow-hidden group relative">
              <span className="text-[10px] font-bold text-gray-400 group-hover:hidden text-center">{p2.commander.name.split('·').pop()}</span>
              <div className="absolute inset-0 bg-black/90 hidden group-hover:flex flex-col items-center justify-center p-1">
                <span className="text-[8px] text-amber-400 font-bold">{p2.commander.passiveName}</span>
                <span className="text-[8px] text-blue-400 font-bold mt-1">{p2.commander.activeName}</span>
              </div>
            </div>
          )}
          <div id="p2-hq">
            <h2 className="text-xl font-bold text-gray-300">{p2.name} - {p2.faction}</h2>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="bg-red-900 px-3 py-1 rounded-full font-bold">HQ 血量: {p2.hqHp} / 25</span>
              <span className="bg-blue-900 px-3 py-1 rounded-full">指挥点: {p2.cp} / {p2.maxCp}</span>
              <span className="bg-gray-700 px-3 py-1 rounded-full">手牌数: {p2.hand.length}</span>
            </div>
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
          <div className="flex items-center gap-4">
            {/* 我方指挥官 */}
            {p1.commander && (
              <div className="flex items-center gap-2">
                <div className="w-20 h-20 bg-gray-900 rounded-full border-2 border-blue-700 flex items-center justify-center flex-col shadow-lg overflow-hidden group relative">
                  <span className="text-xs font-bold text-gray-300 group-hover:hidden text-center">{p1.commander.name.split('·').pop()}</span>
                  <div className="absolute inset-0 bg-black/90 hidden group-hover:flex flex-col items-center justify-center p-1 text-center">
                    <span className="text-[10px] text-amber-400 font-bold">{p1.commander.passiveName}</span>
                    <span className="text-[8px] text-gray-400 mt-1">{p1.commander.passiveDesc}</span>
                  </div>
                </div>
                {game.currentPlayer === p1 && p1.cp >= p1.commander.activeCost && (
                  <button 
                    onClick={() => {
                       if (gameMode === 'multiplayer' && !isHost) {
                         networkManager.send({ type: 'USE_SKILL' });
                         return;
                       }
                       p1.cp -= p1!.commander!.activeCost;
                       p1.commander!.useActive(game, p1);
                       showToast(`指挥官技能: ${p1.commander!.activeName}`);
                       game.addLog(p1.name, `消耗 ${p1.commander!.activeCost} CP 释放了主动技能 [${p1.commander!.activeName}]！`, 'skill');
                       forceUpdate();
                       if (gameMode === 'multiplayer' && isHost) {
                         networkManager.send({ type: 'SYNC_STATE', state: game!.serialize() });
                         networkManager.send({ type: 'VFX', cardId: 'cmd-skill', isP1: true });
                       }
                       playOrderVFX('cmd-skill', true);
                    }}
                    className="bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-purple-900 shadow-lg animate-pulse flex flex-col items-center"
                  >
                    <span className="text-sm">{p1.commander.activeName}</span>
                    <span className="text-xs text-purple-300">(-{p1.commander.activeCost} CP)</span>
                  </button>
                )}
              </div>
            )}
            <div id="p1-hq">
              <h2 className="text-2xl font-bold text-white">{p1.name} - {p1.faction}</h2>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="bg-red-900 px-3 py-1 rounded-full font-bold shadow-inner">HQ 血量: {p1.hqHp} / 25</span>
                <span className="bg-blue-900 px-3 py-1 rounded-full font-bold shadow-inner">指挥点(CP): <span className="text-yellow-400 text-lg">{p1.cp}</span> / {p1.maxCp}</span>
                <span className="bg-gray-700 px-3 py-1 rounded-full">牌库剩余: {p1.deck.length}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <button onClick={() => setShowLogs(!showLogs)} className="mb-4 text-sm bg-gray-700 hover:bg-gray-600 px-4 py-1 rounded-full border border-gray-500 transition-colors">
               {showLogs ? '隐藏日志' : '📜 查看对战日志'}
             </button>
             <div className={`text-xl font-bold mb-2 ${game.currentPlayer === p1 ? 'text-green-400' : 'text-gray-500'}`}>
                    回合 {game.turnNumber} : {game.currentPlayer.name} 的回合
                    {game.maxTurns !== Infinity && <span className="ml-4 text-red-400 text-sm">(战役限时: 剩余 {game.maxTurns - game.currentRound + 1} 回合)</span>}
                 </div>
             <button onClick={handleEndTurn} disabled={game.currentPlayer !== p1}
               className={`font-bold py-3 px-8 rounded-xl border-b-4 transition-all ${game.currentPlayer === p1 ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800 text-white active:border-b-0 active:translate-y-1' : 'bg-gray-700 text-gray-500 border-gray-900 cursor-not-allowed'}`}
             >
               {game.currentPlayer === p1 ? '结束回合' : (gameMode === 'multiplayer' ? '等待对方回合...' : 'AI 思考中...')}
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

      <AnimatePresence>
        {transientVfx.map((vfx) => (
          <motion.div
            key={vfx.id}
            initial={{ opacity: 1, y: vfx.type === 'death' ? vfx.y : vfx.y + 20, scale: vfx.type === 'death' ? 0.5 : 1.5 }}
            animate={{ opacity: 0, y: vfx.type === 'death' ? vfx.y : vfx.y - 80, scale: vfx.type === 'death' ? 2 : 1 }}
            transition={{ duration: vfx.type === 'death' ? 0.6 : 1.2, ease: "easeOut" }}
            className={`fixed pointer-events-none z-50 flex items-center justify-center font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] ${vfx.type === 'death' ? 'text-8xl' : 'text-5xl'}`}
            style={{ left: vfx.x, top: vfx.y, transform: 'translate(-50%, -50%)', color: vfx.type === 'damage' ? '#ff3333' : vfx.type === 'heal' ? '#33ff33' : vfx.type === 'armor' ? '#a0aec0' : '#ffa500' }}
          >
            {vfx.type === 'death' ? '💥' : vfx.text}
          </motion.div>
        ))}
      </AnimatePresence>

      {(game.isGameOver) && (() => {
        const isTimeOut = game.maxTurns !== Infinity && game.currentRound > game.maxTurns;
        const isDefeat = p1.hqHp <= 0 || isTimeOut;
        const isVictory = p2.hqHp <= 0 && !isDefeat;
        
        if (isVictory && gameMode === 'campaign' && selectedCampaign) {
           const scenario = CAMPAIGN_SCENARIOS.find(c => c.id === selectedCampaign);
           if (scenario && scenario.rewardCardId) {
              let unlockedIds: string[] = [];
              try { unlockedIds = JSON.parse(localStorage.getItem('unlockedCards') || '[]'); } catch(e) {}
              if (!unlockedIds.includes(scenario.rewardCardId)) {
                unlockedIds.push(scenario.rewardCardId);
                localStorage.setItem('unlockedCards', JSON.stringify(unlockedIds));
              }
           }
        }

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center flex-col">
            <h1 className="text-6xl font-bold text-red-500 mb-4 tracking-widest drop-shadow-lg">{isVictory ? '游戏胜利 (VICTORY)' : '游戏失败 (DEFEAT)'}</h1>
            {isTimeOut && <p className="text-xl text-yellow-500 mb-4 font-bold">时间耗尽！指挥部已下达撤退命令。</p>}
            {isVictory && gameMode === 'campaign' && (
              <p className="text-2xl text-green-400 mb-8 font-bold animate-pulse">🎉 战役胜利！高级卡牌奖励已解锁。</p>
            )}
            <button onClick={() => window.location.reload()} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-12 rounded-xl border-b-4 border-yellow-800 text-2xl transition-transform hover:-translate-y-1 active:translate-y-1 active:border-b-0 mt-4">重新开始</button>
          </div>
        );
      })()}
    </div>
  );
}
