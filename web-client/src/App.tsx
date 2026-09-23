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
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import './index.css';

import { AudioEngine } from './engine/AudioEngine';

import { KeywordEngine } from './engine/KeywordEngine';

// --- 指挥官系统库 ---
export function getCommandersData(): Commander[] {
  const commanders: Commander[] = [
    {
      id: 'cmd-zhukov', name: i18n.t('cards.commander_77.name'), faction: Faction.SOVIET,
      passiveName: i18n.t('cards.commander_77.passiveName'), passiveDesc: i18n.t('cards.commander_77.passiveDesc'),
      activeName: i18n.t('cards.commander_77.activeName'), activeDesc: i18n.t('cards.commander_77.activeDesc'),
      activeCost: 6, activeCooldown: 0,
      onTurnStart: (game, player) => { player.hqHp = Math.min(25, player.hqHp + 1); },
      useActive: (game, player) => { player.board.forEach((u: UnitCard) => { u.attack += 1; u.hp += 1; u.maxHp += 1; }); }
    },
    {
      id: 'cmd-rommel', name: i18n.t('cards.commander_78.name'), faction: Faction.GERMANY,
      passiveName: i18n.t('cards.commander_78.passiveName'), passiveDesc: i18n.t('cards.commander_78.passiveDesc'),
      activeName: i18n.t('cards.commander_78.activeName'), activeDesc: i18n.t('cards.commander_78.activeDesc'),
      activeCost: 5, activeCooldown: 0,
      onTurnStart: (game, player) => { player.cp += 1; },
      useActive: (game, player) => { player.board.filter((u: UnitCard) => u.category === UnitCategory.ARMOR).forEach((u: UnitCard) => { if(!u.keywords.includes(Keyword.BLITZ)) u.keywords.push(Keyword.BLITZ); u.hasAttackedThisTurn = false; }); }
    },
    {
      id: 'cmd-patton', name: i18n.t('cards.commander_79.name'), faction: Faction.USA,
      passiveName: i18n.t('cards.commander_79.passiveName'), passiveDesc: i18n.t('cards.commander_79.passiveDesc'),
      activeName: i18n.t('cards.commander_79.activeName'), activeDesc: i18n.t('cards.commander_79.activeDesc'),
      activeCost: 7, activeCooldown: 0,
      onTurnStart: (game, player) => {}, // 被动在playCard时生效或者全局生效，这里简化为只影响已部署的，我们在每次更新时处理，或者写死在部署逻辑。这里用被动加成？我们改为每回合给新部署的加？太复杂。改回每回合开始时所有步兵攻击力+1？不行。改成每回合开始时，总部受伤害减免？
      // 重写被动：每回合开始时，随机使一个我方单位攻击力+1。
      useActive: (game, player) => { const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1; enemy.board.forEach((u: UnitCard) => u.hp -= 2); enemy.board = enemy.board.filter((u: UnitCard) => u.hp > 0); }
    },
    {
      id: 'cmd-monty', name: i18n.t('cards.commander_80.name'), faction: Faction.UK,
      passiveName: i18n.t('cards.commander_80.passiveName'), passiveDesc: i18n.t('cards.commander_80.passiveDesc'),
      activeName: i18n.t('cards.commander_80.activeName'), activeDesc: i18n.t('cards.commander_80.activeDesc'),
      activeCost: 3, activeCooldown: 0,
      onTurnStart: (game, player) => { if(player.board.some((u: UnitCard) => u.line === 'frontline')) player.hqHp = Math.min(25, player.hqHp + 2); },
      useActive: (game, player) => { player.drawCard(2); }
    },
    {
      id: 'cmd-degaulle', name: i18n.t('cards.commander_81.name'), faction: Faction.FRANCE,
      passiveName: i18n.t('cards.commander_81.passiveName'), passiveDesc: i18n.t('cards.commander_81.passiveDesc'),
      activeName: i18n.t('cards.commander_81.activeName'), activeDesc: i18n.t('cards.commander_81.activeDesc'),
      activeCost: 4, activeCooldown: 0,
      onTurnStart: (game, player) => { if(player.hqHp < 10) player.drawCard(1); },
      useActive: (game, player) => { player.hqHp = Math.min(25, player.hqHp + 5); }
    }
  ];
  
  // 修正巴顿被动
  commanders[2].passiveDesc = '每回合开始时，随机使我方一个单位攻击力+1。';
  commanders[2].onTurnStart = (game, player) => { if(player.board.length > 0) { const target = player.board[Math.floor(Math.random() * player.board.length)]; target.attack += 1; } };

  return commanders;
}

// --- 环境卡数据 ---
export function getEnvironmentCardsData(): Omit<EnvironmentCard, 'id' | 'faction'>[] {
  return [
    {
      name: i18n.t('cards.order_44.name'), description: i18n.t('cards.order_44.desc'), type: CardType.ENVIRONMENT, deployCost: 4,
      onPlay: (game) => {},
      onTurnStart: (game) => {
        game.player1.board.filter((u: UnitCard) => u.line === 'frontline').forEach((u: UnitCard) => u.hp -= 1);
        game.player2.board.filter((u: UnitCard) => u.line === 'frontline').forEach((u: UnitCard) => u.hp -= 1);
        game.player1.board = game.player1.board.filter((u: UnitCard) => u.hp > 0);
        game.player2.board = game.player2.board.filter((u: UnitCard) => u.hp > 0);
      }
    },
    {
      name: i18n.t('cards.order_45.name'), description: i18n.t('cards.order_45.desc'), type: CardType.ENVIRONMENT, deployCost: 3,
      onPlay: (game) => {
        game.player1.board.filter((u: UnitCard) => u.category === UnitCategory.ARMOR).forEach((u: UnitCard) => u.moveCost += 1);
        game.player2.board.filter((u: UnitCard) => u.category === UnitCategory.ARMOR).forEach((u: UnitCard) => u.moveCost += 1);
      },
      onTurnStart: (game) => {}
    },
    {
      name: i18n.t('cards.order_46.name'), description: i18n.t('cards.order_46.desc'), type: CardType.ENVIRONMENT, deployCost: 3,
      onPlay: (game) => {},
      onTurnStart: (game) => {
        game.player1.board.filter((u: UnitCard) => u.category === UnitCategory.INFANTRY).forEach((u: UnitCard) => u.attack += 1);
        game.player2.board.filter((u: UnitCard) => u.category === UnitCategory.INFANTRY).forEach((u: UnitCard) => u.attack += 1);
      }
    }
  ];
}

// --- 真实历史单位库 ---
export function getSovietUnits(): any[] {
  return [
    { name: i18n.t('cards.unit_1.name'), cat: UnitCategory.INFANTRY, cost: 1, atk: 2, def: 1, hp: 3, desc: i18n.t('cards.unit_1.desc'), keywords: [], exclusiveId: 'soviet_1', exclusiveName: i18n.t('cards.unit_1.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_1.exclusiveDesc') },
    { name: i18n.t('cards.unit_2.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 3, hp: 6, desc: i18n.t('cards.unit_2.desc'), keywords: [Keyword.GUARD], exclusiveId: 'soviet_2', exclusiveName: i18n.t('cards.unit_2.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_2.exclusiveDesc') },
    { name: i18n.t('cards.unit_3.name'), cat: UnitCategory.INFANTRY, cost: 2, atk: 3, def: 2, hp: 4, desc: i18n.t('cards.unit_3.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'soviet_3', exclusiveName: i18n.t('cards.unit_3.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_3.exclusiveDesc') },
    { name: i18n.t('cards.unit_4.name'), cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 5, hp: 8, desc: i18n.t('cards.unit_4.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'soviet_4', exclusiveName: i18n.t('cards.unit_4.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_4.exclusiveDesc') },
    { name: i18n.t('cards.unit_5.name'), cat: UnitCategory.ARMOR, cost: 6, atk: 7, def: 6, hp: 9, desc: i18n.t('cards.unit_5.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'soviet_5', exclusiveName: i18n.t('cards.unit_5.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_5.exclusiveDesc') },
    { name: i18n.t('cards.unit_6.name'), cat: UnitCategory.ARMOR, cost: 8, atk: 10, def: 8, hp: 12, desc: i18n.t('cards.unit_6.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'soviet_6', exclusiveName: i18n.t('cards.unit_6.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_6.exclusiveDesc') },
    { name: i18n.t('cards.unit_7.name'), cat: UnitCategory.ARTILLERY, cost: 6, atk: 8, def: 4, hp: 6, desc: i18n.t('cards.unit_7.desc'), keywords: [Keyword.AMBUSH], exclusiveId: 'soviet_7', exclusiveName: i18n.t('cards.unit_7.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_7.exclusiveDesc') },
    { name: i18n.t('cards.unit_8.name'), cat: UnitCategory.AIR_FORCE, cost: 7, atk: 9, def: 2, hp: 5, desc: i18n.t('cards.unit_8.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'soviet_8', exclusiveName: i18n.t('cards.unit_8.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_8.exclusiveDesc') },
    { name: i18n.t('cards.unit_9.name'), cat: UnitCategory.ARTILLERY, cost: 5, atk: 7, def: 1, hp: 4, desc: i18n.t('cards.unit_9.desc'), keywords: [], exclusiveId: 'soviet_9', exclusiveName: i18n.t('cards.unit_9.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_9.exclusiveDesc') },
    { name: i18n.t('cards.unit_10.name'), cat: UnitCategory.ARMOR, cost: 7, atk: 6, def: 9, hp: 14, desc: i18n.t('cards.unit_10.desc'), keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD], exclusiveId: 'soviet_10', exclusiveName: i18n.t('cards.unit_10.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_10.exclusiveDesc') },
    { name: i18n.t('cards.unit_41.name'), cat: UnitCategory.INFANTRY, cost: 2, atk: 4, def: 1, hp: 2, desc: i18n.t('cards.unit_41.desc'), keywords: [Keyword.AMBUSH], exclusiveId: 'soviet_11', exclusiveName: i18n.t('cards.unit_41.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_41.exclusiveDesc') },
    { name: i18n.t('cards.unit_42.name'), cat: UnitCategory.ARMOR, cost: 3, atk: 4, def: 2, hp: 4, desc: i18n.t('cards.unit_42.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'soviet_12', exclusiveName: i18n.t('cards.unit_42.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_42.exclusiveDesc') },
    { name: i18n.t('cards.unit_43.name'), cat: UnitCategory.AIR_FORCE, cost: 6, atk: 7, def: 2, hp: 4, desc: i18n.t('cards.unit_43.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'soviet_13', exclusiveName: i18n.t('cards.unit_43.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_43.exclusiveDesc') }
  ];
}

export function getGermanUnits(): any[] {
  return [
    { name: i18n.t('cards.unit_11.name'), cat: UnitCategory.INFANTRY, cost: 1, atk: 2, def: 1, hp: 2, desc: i18n.t('cards.unit_11.desc'), keywords: [], exclusiveId: 'german_1', exclusiveName: i18n.t('cards.unit_11.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_11.exclusiveDesc') },
    { name: i18n.t('cards.unit_12.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 4, hp: 5, desc: i18n.t('cards.unit_12.desc'), keywords: [], exclusiveId: 'german_2', exclusiveName: i18n.t('cards.unit_12.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_12.exclusiveDesc') },
    { name: i18n.t('cards.unit_13.name'), cat: UnitCategory.INFANTRY, cost: 4, atk: 5, def: 4, hp: 6, desc: i18n.t('cards.unit_13.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'german_3', exclusiveName: i18n.t('cards.unit_13.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_13.exclusiveDesc') },
    { name: i18n.t('cards.unit_14.name'), cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 5, hp: 7, desc: i18n.t('cards.unit_14.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'german_4', exclusiveName: i18n.t('cards.unit_14.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_14.exclusiveDesc') },
    { name: i18n.t('cards.unit_15.name'), cat: UnitCategory.ARMOR, cost: 7, atk: 8, def: 7, hp: 9, desc: i18n.t('cards.unit_15.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'german_5', exclusiveName: i18n.t('cards.unit_15.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_15.exclusiveDesc') },
    { name: i18n.t('cards.unit_16.name'), cat: UnitCategory.ARMOR, cost: 9, atk: 12, def: 10, hp: 10, desc: i18n.t('cards.unit_16.desc'), keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD], exclusiveId: 'german_6', exclusiveName: i18n.t('cards.unit_16.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_16.exclusiveDesc') },
    { name: i18n.t('cards.unit_17.name'), cat: UnitCategory.ARMOR, cost: 4, atk: 3, def: 4, hp: 6, desc: i18n.t('cards.unit_17.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'german_7', exclusiveName: i18n.t('cards.unit_17.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_17.exclusiveDesc') },
    { name: i18n.t('cards.unit_18.name'), cat: UnitCategory.ARTILLERY, cost: 6, atk: 10, def: 2, hp: 5, desc: i18n.t('cards.unit_18.desc'), keywords: [Keyword.ANTI_AIR, Keyword.GUARD], exclusiveId: 'german_8', exclusiveName: i18n.t('cards.unit_18.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_18.exclusiveDesc') },
    { name: i18n.t('cards.unit_19.name'), cat: UnitCategory.AIR_FORCE, cost: 6, atk: 8, def: 3, hp: 4, desc: i18n.t('cards.unit_19.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'german_9', exclusiveName: i18n.t('cards.unit_19.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_19.exclusiveDesc') },
    { name: i18n.t('cards.unit_20.name'), cat: UnitCategory.AIR_FORCE, cost: 7, atk: 10, def: 2, hp: 4, desc: i18n.t('cards.unit_20.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'german_10', exclusiveName: i18n.t('cards.unit_20.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_20.exclusiveDesc') },
    { name: i18n.t('cards.unit_44.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 2, hp: 4, desc: i18n.t('cards.unit_44.desc'), keywords: [Keyword.BLITZ, Keyword.AMBUSH], exclusiveId: 'german_11', exclusiveName: i18n.t('cards.unit_44.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_44.exclusiveDesc') },
    { name: i18n.t('cards.unit_45.name'), cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 4, hp: 6, desc: i18n.t('cards.unit_45.desc'), keywords: [Keyword.AMBUSH], exclusiveId: 'german_12', exclusiveName: i18n.t('cards.unit_45.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_45.exclusiveDesc') },
    { name: i18n.t('cards.unit_46.name'), cat: UnitCategory.ARTILLERY, cost: 7, atk: 12, def: 2, hp: 6, desc: i18n.t('cards.unit_46.desc'), keywords: [], exclusiveId: 'german_13', exclusiveName: i18n.t('cards.unit_46.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_46.exclusiveDesc') },
    { name: i18n.t('cards.unit_47.name'), cat: UnitCategory.AIR_FORCE, cost: 7, atk: 9, def: 3, hp: 5, desc: i18n.t('cards.unit_47.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'german_14', exclusiveName: i18n.t('cards.unit_47.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_47.exclusiveDesc') }
  ];
}

export function getUSAUnits(): any[] {
  return [
    { name: i18n.t('cards.unit_21.name'), cat: UnitCategory.INFANTRY, cost: 2, atk: 3, def: 2, hp: 4, desc: i18n.t('cards.unit_21.desc'), keywords: [], exclusiveId: 'usa_1', exclusiveName: i18n.t('cards.unit_21.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_21.exclusiveDesc') },
    { name: i18n.t('cards.unit_22.name'), cat: UnitCategory.INFANTRY, cost: 4, atk: 5, def: 3, hp: 5, desc: i18n.t('cards.unit_22.desc'), keywords: [Keyword.AMBUSH], exclusiveId: 'usa_2', exclusiveName: i18n.t('cards.unit_22.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_22.exclusiveDesc') },
    { name: i18n.t('cards.unit_23.name'), cat: UnitCategory.ARMOR, cost: 5, atk: 6, def: 5, hp: 8, desc: i18n.t('cards.unit_23.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'usa_3', exclusiveName: i18n.t('cards.unit_23.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_23.exclusiveDesc') },
    { name: i18n.t('cards.unit_24.name'), cat: UnitCategory.ARMOR, cost: 8, atk: 9, def: 8, hp: 10, desc: i18n.t('cards.unit_24.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'usa_4', exclusiveName: i18n.t('cards.unit_24.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_24.exclusiveDesc') },
    { name: i18n.t('cards.unit_25.name'), cat: UnitCategory.ARTILLERY, cost: 5, atk: 7, def: 3, hp: 5, desc: i18n.t('cards.unit_25.desc'), keywords: [], exclusiveId: 'usa_5', exclusiveName: i18n.t('cards.unit_25.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_25.exclusiveDesc') },
    { name: i18n.t('cards.unit_26.name'), cat: UnitCategory.AIR_FORCE, cost: 7, atk: 8, def: 3, hp: 5, desc: i18n.t('cards.unit_26.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'usa_6', exclusiveName: i18n.t('cards.unit_26.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_26.exclusiveDesc') },
    { name: i18n.t('cards.unit_27.name'), cat: UnitCategory.AIR_FORCE, cost: 9, atk: 10, def: 5, hp: 12, desc: i18n.t('cards.unit_27.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'usa_7', exclusiveName: i18n.t('cards.unit_27.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_27.exclusiveDesc') },
    { name: i18n.t('cards.unit_48.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 2, hp: 4, desc: i18n.t('cards.unit_48.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'usa_8', exclusiveName: i18n.t('cards.unit_48.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_48.exclusiveDesc') },
    { name: i18n.t('cards.unit_49.name'), cat: UnitCategory.ARMOR, cost: 6, atk: 8, def: 4, hp: 7, desc: i18n.t('cards.unit_49.desc'), keywords: [Keyword.BLITZ, Keyword.AMBUSH], exclusiveId: 'usa_9', exclusiveName: i18n.t('cards.unit_49.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_49.exclusiveDesc') },
    { name: i18n.t('cards.unit_50.name'), cat: UnitCategory.ARTILLERY, cost: 3, atk: 4, def: 1, hp: 3, desc: i18n.t('cards.unit_50.desc'), keywords: [], exclusiveId: 'usa_10', exclusiveName: i18n.t('cards.unit_50.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_50.exclusiveDesc') },
    { name: i18n.t('cards.unit_51.name'), cat: UnitCategory.AIR_FORCE, cost: 6, atk: 7, def: 4, hp: 6, desc: i18n.t('cards.unit_51.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'usa_11', exclusiveName: i18n.t('cards.unit_51.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_51.exclusiveDesc') }
  ];
}

export function getUKUnits(): any[] {
  return [
    { name: i18n.t('cards.unit_28.name'), cat: UnitCategory.INFANTRY, cost: 2, atk: 3, def: 3, hp: 5, desc: i18n.t('cards.unit_28.desc'), keywords: [Keyword.GUARD], exclusiveId: 'uk_1', exclusiveName: i18n.t('cards.unit_28.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_28.exclusiveDesc') },
    { name: i18n.t('cards.unit_29.name'), cat: UnitCategory.INFANTRY, cost: 4, atk: 5, def: 2, hp: 4, desc: i18n.t('cards.unit_29.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'uk_2', exclusiveName: i18n.t('cards.unit_29.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_29.exclusiveDesc') },
    { name: i18n.t('cards.unit_30.name'), cat: UnitCategory.ARMOR, cost: 4, atk: 5, def: 3, hp: 6, desc: i18n.t('cards.unit_30.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'uk_3', exclusiveName: i18n.t('cards.unit_30.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_30.exclusiveDesc') },
    { name: i18n.t('cards.unit_31.name'), cat: UnitCategory.ARMOR, cost: 6, atk: 5, def: 8, hp: 10, desc: i18n.t('cards.unit_31.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'uk_4', exclusiveName: i18n.t('cards.unit_31.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_31.exclusiveDesc') },
    { name: i18n.t('cards.unit_32.name'), cat: UnitCategory.ARTILLERY, cost: 5, atk: 6, def: 2, hp: 5, desc: i18n.t('cards.unit_32.desc'), keywords: [], exclusiveId: 'uk_5', exclusiveName: i18n.t('cards.unit_32.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_32.exclusiveDesc') },
    { name: i18n.t('cards.unit_33.name'), cat: UnitCategory.AIR_FORCE, cost: 7, atk: 9, def: 2, hp: 4, desc: i18n.t('cards.unit_33.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'uk_6', exclusiveName: i18n.t('cards.unit_33.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_33.exclusiveDesc') },
    { name: i18n.t('cards.unit_34.name'), cat: UnitCategory.AIR_FORCE, cost: 8, atk: 9, def: 4, hp: 10, desc: i18n.t('cards.unit_34.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'uk_7', exclusiveName: i18n.t('cards.unit_34.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_34.exclusiveDesc') },
    { name: i18n.t('cards.unit_52.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 3, def: 4, hp: 5, desc: i18n.t('cards.unit_52.desc'), keywords: [Keyword.GUARD], exclusiveId: 'uk_8', exclusiveName: i18n.t('cards.unit_52.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_52.exclusiveDesc') },
    { name: i18n.t('cards.unit_53.name'), cat: UnitCategory.ARMOR, cost: 5, atk: 4, def: 7, hp: 9, desc: i18n.t('cards.unit_53.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'uk_9', exclusiveName: i18n.t('cards.unit_53.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_53.exclusiveDesc') },
    { name: i18n.t('cards.unit_54.name'), cat: UnitCategory.ARTILLERY, cost: 2, atk: 2, def: 1, hp: 3, desc: i18n.t('cards.unit_54.desc'), keywords: [], exclusiveId: 'uk_10', exclusiveName: i18n.t('cards.unit_54.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_54.exclusiveDesc') },
    { name: i18n.t('cards.unit_55.name'), cat: UnitCategory.AIR_FORCE, cost: 6, atk: 8, def: 2, hp: 4, desc: i18n.t('cards.unit_55.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'uk_11', exclusiveName: i18n.t('cards.unit_55.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_55.exclusiveDesc') }
  ];
}

export function getFranceUnits(): any[] {
  return [
    { name: i18n.t('cards.unit_35.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 4, def: 3, hp: 6, desc: i18n.t('cards.unit_35.desc'), keywords: [Keyword.GUARD], exclusiveId: 'france_1', exclusiveName: i18n.t('cards.unit_35.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_35.exclusiveDesc') },
    { name: i18n.t('cards.unit_36.name'), cat: UnitCategory.ARMOR, cost: 4, atk: 5, def: 5, hp: 7, desc: i18n.t('cards.unit_36.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'france_2', exclusiveName: i18n.t('cards.unit_36.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_36.exclusiveDesc') },
    { name: i18n.t('cards.unit_37.name'), cat: UnitCategory.ARMOR, cost: 6, atk: 7, def: 7, hp: 9, desc: i18n.t('cards.unit_37.desc'), keywords: [Keyword.HEAVY_ARMOR], exclusiveId: 'france_3', exclusiveName: i18n.t('cards.unit_37.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_37.exclusiveDesc') },
    { name: i18n.t('cards.unit_38.name'), cat: UnitCategory.INFANTRY, cost: 2, atk: 4, def: 1, hp: 3, desc: i18n.t('cards.unit_38.desc'), keywords: [Keyword.AMBUSH], exclusiveId: 'france_4', exclusiveName: i18n.t('cards.unit_38.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_38.exclusiveDesc') },
    { name: i18n.t('cards.unit_39.name'), cat: UnitCategory.ARTILLERY, cost: 5, atk: 6, def: 2, hp: 5, desc: i18n.t('cards.unit_39.desc'), keywords: [], exclusiveId: 'france_5', exclusiveName: i18n.t('cards.unit_39.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_39.exclusiveDesc') },
    { name: i18n.t('cards.unit_40.name'), cat: UnitCategory.AIR_FORCE, cost: 7, atk: 9, def: 2, hp: 4, desc: i18n.t('cards.unit_40.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'france_6', exclusiveName: i18n.t('cards.unit_40.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_40.exclusiveDesc') },
    { name: i18n.t('cards.unit_56.name'), cat: UnitCategory.INFANTRY, cost: 3, atk: 2, def: 4, hp: 5, desc: i18n.t('cards.unit_56.desc'), keywords: [Keyword.GUARD], exclusiveId: 'france_7', exclusiveName: i18n.t('cards.unit_56.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_56.exclusiveDesc') },
    { name: i18n.t('cards.unit_57.name'), cat: UnitCategory.ARMOR, cost: 3, atk: 3, def: 3, hp: 4, desc: i18n.t('cards.unit_57.desc'), keywords: [Keyword.AMBUSH], exclusiveId: 'france_8', exclusiveName: i18n.t('cards.unit_57.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_57.exclusiveDesc') },
    { name: i18n.t('cards.unit_58.name'), cat: UnitCategory.ARTILLERY, cost: 4, atk: 5, def: 2, hp: 4, desc: i18n.t('cards.unit_58.desc'), keywords: [], exclusiveId: 'france_9', exclusiveName: i18n.t('cards.unit_58.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_58.exclusiveDesc') },
    { name: i18n.t('cards.unit_59.name'), cat: UnitCategory.AIR_FORCE, cost: 5, atk: 6, def: 3, hp: 4, desc: i18n.t('cards.unit_59.desc'), keywords: [Keyword.BLITZ], exclusiveId: 'france_10', exclusiveName: i18n.t('cards.unit_59.exclusiveName'), exclusiveDesc: i18n.t('cards.unit_59.exclusiveDesc') }
  ];
}

// --- 高级隐藏单位库 (通过军校解锁) ---
export function getAdvancedCardsData(): any[] {
  return [
    { id: 'adv-soviet-1', name: i18n.t('cards.adv_1.name'), faction: Faction.SOVIET, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 7, atk: 10, def: 7, hp: 12, desc: i18n.t('cards.adv_1.desc'), keywords: [Keyword.GUARD, Keyword.AMBUSH, Keyword.HEAVY_ARMOR], exclusiveId: 'adv_1', exclusiveName: i18n.t('cards.adv_1.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_1.exclusiveDesc') },
    { id: 'adv-german-1', name: i18n.t('cards.adv_2.name'), faction: Faction.GERMANY, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 10, atk: 14, def: 12, hp: 18, desc: i18n.t('cards.adv_2.desc'), keywords: [Keyword.HEAVY_ARMOR, Keyword.GUARD, Keyword.BLITZ], exclusiveId: 'adv_2', exclusiveName: i18n.t('cards.adv_2.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_2.exclusiveDesc') },
    { id: 'adv-usa-1', name: i18n.t('cards.adv_3.name'), faction: Faction.USA, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 6, atk: 8, def: 5, hp: 8, desc: i18n.t('cards.adv_3.desc'), keywords: [Keyword.BLITZ, Keyword.AMBUSH], exclusiveId: 'adv_3', exclusiveName: i18n.t('cards.adv_3.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_3.exclusiveDesc') },
    { id: 'adv-uk-1', name: i18n.t('cards.adv_4.name'), faction: Faction.UK, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 5, atk: 9, def: 4, hp: 7, desc: i18n.t('cards.adv_4.desc'), keywords: [Keyword.BLITZ, Keyword.AMBUSH], exclusiveId: 'adv_4', exclusiveName: i18n.t('cards.adv_4.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_4.exclusiveDesc') },
    { id: 'adv-france-1', name: i18n.t('cards.adv_5.name'), faction: Faction.FRANCE, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 8, atk: 10, def: 8, hp: 12, desc: i18n.t('cards.adv_5.desc'), keywords: [Keyword.BLITZ, Keyword.HEAVY_ARMOR], exclusiveId: 'adv_5', exclusiveName: i18n.t('cards.adv_5.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_5.exclusiveDesc') },
    { id: 'adv-soviet-2', name: i18n.t('cards.adv_6.name'), faction: Faction.SOVIET, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 5, atk: 7, def: 5, hp: 8, desc: i18n.t('cards.adv_6.desc'), keywords: [Keyword.AMBUSH, Keyword.GUARD], exclusiveId: 'adv_6', exclusiveName: i18n.t('cards.adv_6.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_6.exclusiveDesc') },
    { id: 'adv-german-2', name: i18n.t('cards.adv_7.name'), faction: Faction.GERMANY, type: CardType.UNIT, cat: UnitCategory.ARMOR, cost: 8, atk: 12, def: 8, hp: 14, desc: i18n.t('cards.adv_7.desc'), keywords: [Keyword.HEAVY_ARMOR, Keyword.AMBUSH], exclusiveId: 'adv_7', exclusiveName: i18n.t('cards.adv_7.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_7.exclusiveDesc') },
    { id: 'adv-usa-2', name: i18n.t('cards.adv_8.name'), faction: Faction.USA, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 5, atk: 7, def: 4, hp: 6, desc: i18n.t('cards.adv_8.desc'), keywords: [Keyword.BLITZ, Keyword.AMBUSH], exclusiveId: 'adv_8', exclusiveName: i18n.t('cards.adv_8.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_8.exclusiveDesc') },
    { id: 'adv-uk-2', name: i18n.t('cards.adv_9.name'), faction: Faction.UK, type: CardType.UNIT, cat: UnitCategory.ARTILLERY, cost: 7, atk: 10, def: 5, hp: 8, desc: i18n.t('cards.adv_9.desc'), keywords: [Keyword.GUARD], exclusiveId: 'adv_9', exclusiveName: i18n.t('cards.adv_9.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_9.exclusiveDesc') },
    { id: 'adv-france-2', name: i18n.t('cards.adv_10.name'), faction: Faction.FRANCE, type: CardType.UNIT, cat: UnitCategory.INFANTRY, cost: 4, atk: 6, def: 4, hp: 6, desc: i18n.t('cards.adv_10.desc'), keywords: [Keyword.AMBUSH, Keyword.GUARD], exclusiveId: 'adv_10', exclusiveName: i18n.t('cards.adv_10.exclusiveName'), exclusiveDesc: i18n.t('cards.adv_10.exclusiveDesc') }
  ];
}

export function getAdvancedOrdersData(): any[] {
  return [
  {
    id: 'adv-order-soviet', name: i18n.t('cards.order_41.name'), faction: Faction.SOVIET, type: CardType.ORDER, cost: 6, description: i18n.t('cards.order_41.desc'),
    effect: (game: Game) => { game.currentPlayer.board.forEach(u => { u.attack += 5; u.hp += 5; u.maxHp += 5; }); }
  },
  {
    id: 'adv-order-german', name: i18n.t('cards.order_42.name'), faction: Faction.GERMANY, type: CardType.ORDER, cost: 6, description: i18n.t('cards.order_42.desc'),
    effect: (game: Game) => { game.currentPlayer.board.forEach(u => { u.attack += 3; u.hasAttackedThisTurn = false; u.hasMovedThisTurn = false; if(!u.keywords.includes(Keyword.HEAVY_ARMOR)) u.keywords.push(Keyword.HEAVY_ARMOR); }); }
  },
  {
    id: 'adv-order-manhattan', name: i18n.t('cards.order_43.name'), faction: Faction.USA, type: CardType.ORDER, cost: 10, description: i18n.t('cards.order_43.desc'),
    effect: (game: Game) => { 
      const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1; 
      const hqId = enemy === game.player2 ? 'p2-hq' : 'p1-hq';
      enemy.takeHqDamage(12); 
      game.onVfx?.('damage', '-12', hqId);
    }
  }
  ];
}

// --- 真实历史背景指令卡 ---
export function createGenericOrders(faction: Faction): OrderCard[] {
  return [
    {
      id: `${faction}-order-1`, name: i18n.t('cards.order_47.name'), description: i18n.t('cards.order_47.desc'),
      type: CardType.ORDER, faction: faction, deployCost: 3,
      effect: (game: Game) => {
        const p = game.currentPlayer;
        p.drawCard(2); p.hqHp = Math.min(25, p.hqHp + 3);
      }
    },
    {
      id: `${faction}-order-2`, name: i18n.t('cards.order_48.name'), description: i18n.t('cards.order_48.desc'),
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
      id: `${faction}-order-mine`, name: i18n.t('cards.order_49.name'), description: i18n.t('cards.order_49.desc'),
      type: CardType.ORDER, faction: faction, deployCost: 2,
      effect: (game: Game) => {
        const mine: UnitCard = {
          id: `${faction}-mine-${Math.random().toString(36).substring(7)}`, name: i18n.t('cards.order_50.name'), description: i18n.t('cards.order_50.desc'),
          type: CardType.UNIT, category: UnitCategory.INFANTRY, faction: faction,
          deployCost: 2, attack: 15, defense: 1, hp: 1, maxHp: 1, moveCost: 0,
          keywords: [Keyword.AMBUSH],
          hasMovedThisTurn: true, hasAttackedThisTurn: true, line: 'support'
        };
        game.currentPlayer.board.push(mine);
      }
    },
    {
      id: `${faction}-order-sandbag`, name: i18n.t('cards.order_51.name'), description: i18n.t('cards.order_51.desc'),
      type: CardType.ORDER, faction: faction, deployCost: 2,
      effect: (game: Game) => {
        const sandbag: UnitCard = {
          id: `${faction}-sandbag-${Math.random().toString(36).substring(7)}`, name: i18n.t('cards.order_52.name'), description: i18n.t('cards.order_52.desc'),
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
      id: 'soviet-order-heal', name: i18n.t('cards.order_53.name'), description: i18n.t('cards.order_53.desc'),
      type: CardType.ORDER, faction: Faction.SOVIET, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
    {
      id: 'soviet-order-ura', name: i18n.t('cards.order_54.name'), description: i18n.t('cards.order_54.desc'),
      type: CardType.ORDER, faction: Faction.SOVIET, deployCost: 3,
      effect: (game: Game) => {
        game.currentPlayer.board.forEach(u => { u.attack += 2; u.hp += 1; u.maxHp += 1; });
      }
    },
    {
      id: 'soviet-order-katyusha', name: i18n.t('cards.order_55.name'), description: i18n.t('cards.order_55.desc'),
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
      id: 'german-order-heal', name: i18n.t('cards.order_56.name'), description: i18n.t('cards.order_56.desc'),
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
    {
      id: 'german-order-blitzkrieg', name: i18n.t('cards.order_57.name'), description: i18n.t('cards.order_57.desc'),
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 3,
      effect: (game: Game) => {
        const player = game.currentPlayer;
        player.drawCard(2);
        player.cp += 2;
        player.board.forEach(u => { u.hasAttackedThisTurn = false; u.hasMovedThisTurn = false; });
      }
    },
    {
      id: 'german-order-v1', name: i18n.t('cards.order_58.name'), description: i18n.t('cards.order_58.desc'),
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 3,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        const hasAirForce = enemy.board.some(u => u.category === UnitCategory.AIR_FORCE);
        const hqId = enemy === game.player2 ? 'p2-hq' : 'p1-hq';
        if (hasAirForce && Math.random() < 0.5) {
          game.addLog(enemy.name, i18n.t('game.interceptedV1'), 'system');
          game.onVfx?.('armor', '被拦截', hqId);
        } else {
          enemy.takeHqDamage(4);
          game.onVfx?.('damage', '-4', hqId);
        }
      }
    },
    {
      id: 'german-order-v2', name: i18n.t('cards.order_59.name'), description: i18n.t('cards.order_59.desc'),
      type: CardType.ORDER, faction: Faction.GERMANY, deployCost: 5,
      effect: (game: Game) => {
        const enemy = game.currentPlayer === game.player1 ? game.player2 : game.player1;
        const hqId = enemy === game.player2 ? 'p2-hq' : 'p1-hq';
        enemy.takeHqDamage(6);
        game.onVfx?.('damage', '-6', hqId);
      }
    }
  ];
}

export function createUSAOrders(): OrderCard[] {
  return [
    {
      id: 'usa-order-heal', name: i18n.t('cards.order_60.name'), description: i18n.t('cards.order_60.desc'),
      type: CardType.ORDER, faction: Faction.USA, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
    {
      id: 'usa-order-carpet', name: i18n.t('cards.order_61.name'), description: i18n.t('cards.order_61.desc'),
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
      id: 'usa-order-logistics', name: i18n.t('cards.order_62.name'), description: i18n.t('cards.order_62.desc'),
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
      id: 'uk-order-heal', name: i18n.t('cards.order_63.name'), description: i18n.t('cards.order_63.desc'),
      type: CardType.ORDER, faction: Faction.UK, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
    {
      id: 'uk-order-radar', name: i18n.t('cards.order_64.name'), description: i18n.t('cards.order_64.desc'),
      type: CardType.ORDER, faction: Faction.UK, deployCost: 3,
      effect: (game: Game) => {
        const player = game.currentPlayer;
        player.drawCard(2);
        player.board.forEach(u => u.defense += 1);
      }
    },
    {
      id: 'uk-order-navy', name: i18n.t('cards.order_65.name'), description: i18n.t('cards.order_65.desc'),
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
      id: 'france-order-heal', name: i18n.t('cards.order_66.name'), description: i18n.t('cards.order_66.desc'),
      type: CardType.ORDER, faction: Faction.FRANCE, deployCost: 3,
      effect: (game: Game) => { game.currentPlayer.hqHp = Math.min(25, game.currentPlayer.hqHp + 8); }
    },
    {
      id: 'france-order-maginot', name: i18n.t('cards.order_67.name'), description: i18n.t('cards.order_67.desc'),
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
      id: 'france-order-resistance', name: i18n.t('cards.order_68.name'), description: i18n.t('cards.order_68.desc'),
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

  const ADVANCED_CARDS_DATA = getAdvancedCardsData();
  const ADVANCED_ORDERS_DATA = getAdvancedOrdersData();
  const ENVIRONMENT_CARDS_DATA = getEnvironmentCardsData();
  const myAdvancedUnits = ADVANCED_CARDS_DATA.filter(c => c.faction === faction && unlockedIds.includes(c.id));
  const myAdvancedOrders = ADVANCED_ORDERS_DATA.filter(c => c.faction === faction && unlockedIds.includes(c.id));

  // 检查是否有自定义卡组
  try {
      const counts = customCounts || JSON.parse(localStorage.getItem('customDecks') || '{}')[faction];
      if (counts) {
          // 将所有单元补充上统一ID，供匹配
          const allUnits = factionUnits.map(u => ({ ...u, id: `${faction}-unit-${u.name}`, type: CardType.UNIT, category: u.cat, deployCost: u.cost, attack: u.atk, defense: u.def, hp: u.hp, maxHp: u.hp, moveCost: 1, keywords: u.keywords || [], line: 'support', hasMovedThisTurn: false, hasAttackedThisTurn: false }));
          const allAdvUnits = myAdvancedUnits.map(c => ({...c, category: c.cat, deployCost: c.cost, attack: c.atk, defense: c.def, hp: c.hp, maxHp: c.hp, moveCost: 1, description: c.desc, isAdvanced: true, line: 'support', hasMovedThisTurn: false, hasAttackedThisTurn: false}));
          const allAdvOrders = myAdvancedOrders.map(c => ({...c, deployCost: c.cost, isAdvanced: true}));
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
            hasMovedThisTurn: false, hasAttackedThisTurn: false, line: 'support', isAdvanced: true,
            exclusiveId: adv.exclusiveId, exclusiveName: adv.exclusiveName, exclusiveDesc: adv.exclusiveDesc
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
        line: 'support', // 初始进入支援战线
        exclusiveId: u.exclusiveId,
        exclusiveName: u.exclusiveName,
        exclusiveDesc: u.exclusiveDesc
      } as UnitCard);
    }
  }
  return deck;
}

// --- 战役模式数据 ---
export function getCampaignScenarios(): CampaignScenario[] {
  return [
    {
      id: 'campaign-normandy',
      name: i18n.t('cards.order_69.name'),
      description: i18n.t('cards.order_69.desc'),
      playerFaction: Faction.USA,
      aiFaction: Faction.GERMANY,
      maxTurns: 15,
      rewardCardId: 'adv-usa-1',
      setupBoard: (game: Game) => {
        // 史诗级削弱：德军前线部署 2 个暗堡 (原为3个)
        for(let i=0; i<2; i++) {
          const bunker: UnitCard = {
            id: `bunker-${i}`, name: i18n.t('cards.order_70.name'), description: i18n.t('cards.order_70.desc'),
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
      name: i18n.t('cards.order_71.name'),
      description: i18n.t('cards.order_71.desc'),
      playerFaction: Faction.SOVIET,
      aiFaction: Faction.GERMANY,
      maxTurns: 20,
      rewardCardId: 'adv-soviet-1',
      setupBoard: (game: Game) => {
        game.activeEnvironment = getEnvironmentCardsData().find(e => e.name === '城市巷战' || e.name === i18n.t('cards.order_44.name')) as EnvironmentCard;
        // 史诗级削弱：移除开局两辆贴脸的四号坦克，改为两支在支援战线的普通步兵
        for(let i=0; i<2; i++) {
           const infantry: UnitCard = {
             id: `inf-${i}`, name: i18n.t('cards.order_72.name'), description: i18n.t('cards.order_72.desc'),
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
      name: i18n.t('cards.order_73.name'),
      description: i18n.t('cards.order_73.desc'),
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
            name: i18n.t('cards.order_74.name'), description: i18n.t('cards.order_74.desc'), type: CardType.ENVIRONMENT, deployCost: 0, faction: Faction.GERMANY, id: 'env-kursk',
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
      name: i18n.t('cards.order_75.name'),
      description: i18n.t('cards.order_75.desc'),
      playerFaction: Faction.UK,
      aiFaction: Faction.GERMANY,
      maxTurns: 15,
      rewardCardId: 'adv-uk-1',
      setupBoard: (game: Game) => {
        game.activeEnvironment = {
            name: i18n.t('cards.order_76.name'), description: i18n.t('cards.order_76.desc'), type: CardType.ENVIRONMENT, deployCost: 0, faction: Faction.UK, id: 'env-britain',
            onPlay: (g: Game) => {},
            onTurnStart: (g: Game) => {}
        };
        // 为所有场上空军+2攻
        game.player1.board.filter((u: UnitCard) => u.category === UnitCategory.AIR_FORCE).forEach((u: UnitCard) => u.attack += 2);
        game.player2.board.filter((u: UnitCard) => u.category === UnitCategory.AIR_FORCE).forEach((u: UnitCard) => u.attack += 2);
      }
    }
  ];
}

const TypewriterText = ({ text, speed = 30 }: { text: string, speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let i = 0;
    setDisplayedText('');
    setIsTyping(true);
    const timer = setInterval(() => {
      setDisplayedText(text.substring(0, i));
      i++;
      if (i > text.length) {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span>
      {displayedText}
      {isTyping && <span className="typewriter-cursor inline-block w-[2px] h-[1em] ml-1 bg-white align-middle" />}
    </span>
  );
};

export default function App() {
  const { t, i18n } = useTranslation();
  const [gamePhase, setGamePhase] = useState<'lobby' | 'playing'>('lobby');
  const [playerFaction, setPlayerFaction] = useState<Faction>(Faction.SOVIET);
  const [aiFaction, setAiFaction] = useState<Faction>(Faction.GERMANY);
  
  const [gameMode, setGameMode] = useState<'ai' | 'multiplayer' | 'campaign'>('ai');
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>('campaign-normandy');
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
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
    const scenario = isCampaign ? getCampaignScenarios().find(c => c.id === selectedCampaign) : null;

    if (isCampaign && scenario) {
      p1Fac = scenario.playerFaction;
      p2Fac = scenario.aiFaction;
      setPlayerFaction(p1Fac);
      setAiFaction(p2Fac);
    }

    const p1 = new Player(t('game.myCommander'), p1Fac, buildDeck(p1Fac));
    p1.commander = getCommandersData().find(c => c.faction === p1Fac) || null;
    
    let p2Deck = buildDeck(p2Fac);
    if (gameMode === 'multiplayer' && isHost && (window as any).guestDeckCounts) {
        p2Deck = buildDeck(p2Fac, (window as any).guestDeckCounts);
    }
    
    const p2 = new Player(gameMode === 'ai' || isCampaign ? t('game.aiCommander') : t('game.enemyCommander'), p2Fac, p2Deck);
    p2.commander = getCommandersData().find(c => c.faction === p2Fac) || null;
    const newGame = new Game(p1, p2);
    // Bind vfx function before start game so turn 1 env effects work
    newGame.onVfx = spawnTransientVfx;

    if (isCampaign && scenario) {
      newGame.maxTurns = scenario.maxTurns;
      scenario.setupBoard(newGame);
    }

    newGame.startGame();
    setGame(newGame);
    setGamePhase('playing');
    
    if (gameMode === 'multiplayer' && networkManager.isHost) {
      // Send GAME_START with actual factions used
      networkManager.send({ type: 'GAME_START', p1Faction: p1Fac, p2Faction: p2Fac });
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
        // Guest joins, send their custom deck config and faction
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
        const p1 = new Player(t('game.myCommander'), data.p2Faction as Faction, buildDeck(data.p2Faction as Faction));
        p1.commander = getCommandersData().find(c => c.faction === data.p2Faction) || null;
        
        const p2 = new Player(t('game.enemyCommander'), data.p1Faction as Faction, []);
        p2.commander = getCommandersData().find(c => c.faction === data.p1Faction) || null;
        
        const newGame = new Game(p1, p2);
        newGame.onVfx = spawnTransientVfx;
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

  useEffect(() => {
    if (game) {
      game.onVfx = (type, text, targetId) => {
        spawnTransientVfx(type, text, targetId);
        if (gameMode === 'multiplayer' && networkManager.isHost) {
           networkManager.send({ type: 'SPAWN_TRANSIENT_VFX', vfxType: type, text, targetId, isP1: true });
        }
      };
    }
  }, [game, gameMode]);

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

        // 0. AI 判断是否使用指挥官技能 (优化逻辑)
        if (p2.commander && p2.cp >= p2.commander.activeCost && (!p2.commander.currentCooldown || p2.commander.currentCooldown <= 0)) {
          let shouldUse = false;
          // 根据指挥官和局势判断
          if (p2.commander.id === 'cmd-zhukov' || p2.commander.id === 'cmd-patton' || p2.commander.id === 'cmd-degaulle') {
            // 群体增益/回血型：己方场上单位大于等于2时使用
            if (p2.board.length >= 2) shouldUse = true;
          } else if (p2.commander.id === 'cmd-rommel') {
            // 伤害型：敌方场上单位大于等于2时使用
            if (p1.board.length >= 2) shouldUse = true;
          } else if (p2.commander.id === 'cmd-monty') {
            // 护盾型：己方有高价值/残血单位时使用
            if (p2.board.length >= 1) shouldUse = true;
          } else {
            shouldUse = Math.random() > 0.5;
          }

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

        // 3. AI 攻击阶段 (仇恨值系统)
        const attackers = p2.board.filter(u => !u.hasAttackedThisTurn);
        for (const unit of attackers) {
          if (!p2.board.includes(unit)) continue;
          if (p2.hqHp <= 0 || p1.hqHp <= 0) break;

          let validTargets = p1.board;
          
          // 特殊词条判断
          const hasAirborneStrike = unit.exclusiveName === '空降奇袭' || unit.exclusiveName === 'Airborne Strike' || unit.exclusiveName === '天降奇兵';
          const isAntiAirPioneer = unit.exclusiveName === '制空先锋' || unit.exclusiveName === 'Air Superiority Pioneer' || unit.exclusiveName === '制空先鋒';
          const isTankHunter = unit.exclusiveName === '猎甲' || unit.exclusiveName === 'Tank Hunter' || unit.exclusiveName === '獵甲';

          // 步兵不打空军
          if (unit.category === UnitCategory.INFANTRY) validTargets = validTargets.filter(t => t.category !== UnitCategory.AIR_FORCE);
          
          // 射程限制
          if (unit.category !== UnitCategory.ARTILLERY && unit.category !== UnitCategory.AIR_FORCE && !hasAirborneStrike) {
             if (unit.line === 'support') {
                 validTargets = validTargets.filter(t => t.line === 'frontline');
             }
          }

          // 守护限制 (除非有空降奇袭)
          const guards = validTargets.filter(t => t.keywords.includes(Keyword.GUARD));
          if (guards.length > 0 && !hasAirborneStrike) {
            validTargets = guards; // 只能打守护单位
          }

          if (validTargets.length > 0) {
            // 计算仇恨值 (Threat Score)
            const scoredTargets = validTargets.map(t => {
              let score = 0;
              // 1. 击杀潜力：能一击必杀的优先
              let expectedDamage = unit.attack;
              if (t.keywords.includes(Keyword.HEAVY_ARMOR)) expectedDamage -= 2;
              if (expectedDamage >= t.hp) score += 50; 
              
              // 2. 目标价值：敌方攻击力越高、费用越高，威胁越大
              score += t.attack * 2;
              score += t.deployCost * 3;

              // 3. 残血收割：血量越少越容易被集火
              score += (t.maxHp - t.hp) * 2;

              // 4. 专属词条优先度
              if (isAntiAirPioneer && t.category === UnitCategory.AIR_FORCE) score += 100; // 制空先锋优先打飞机
              if (isTankHunter && t.category === UnitCategory.ARMOR) score += 100; // 猎甲优先打坦克
              if (hasAirborneStrike && t.line === 'support') score += 40; // 空降兵倾向切后排

              return { target: t, score };
            });

            // 按仇恨值降序排序，取仇恨值最高的
            scoredTargets.sort((a, b) => b.score - a.score);
            const primaryTarget = scoredTargets[0].target;

            if (executeAttackRef.current) await executeAttackRef.current(unit, primaryTarget, p2, p1, false);
          } else {
            // Check if can attack HQ
            const hqGuards = p1.board.filter(u => u.keywords.includes(Keyword.GUARD));
            const canAtkHq = (unit.category === UnitCategory.ARTILLERY || unit.category === UnitCategory.AIR_FORCE) || (unit.line === 'frontline') || hasAirborneStrike;
            if ((hqGuards.length === 0 || hasAirborneStrike) && canAtkHq) {
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
      if (!game.currentPlayer) return;
      const p1 = game.player1;
      const msg = game.currentPlayer === p1 ? t('game.myTurn') : t('game.enemyTurn');
      setTurnBanner(msg);
      const timer = setTimeout(() => setTurnBanner(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [game?.turnNumber, gamePhase, t, game?.currentPlayer]);

  // 自动滚动日志
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [game?.logs.length, showLogs]);

  // Handle i18n dynamic t function for p1/p2 name when switching language during game
  useEffect(() => {
    if (gamePhase === 'playing' && game) {
      game.player1.name = t('game.myCommander');
      game.player2.name = gameMode === 'ai' || gameMode === 'campaign' ? t('game.aiCommander') : t('game.enemyCommander');
      forceUpdate();
    }
  }, [i18n.language, gamePhase, t, gameMode]);

  if (gamePhase === 'lobby') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] relative">
        
        {/* 语言切换按钮 */}
        <div className="absolute top-8 left-8 flex gap-2">
          <button onClick={() => i18n.changeLanguage('zh')} className={`px-3 py-1 rounded ${i18n.language === 'zh' ? 'bg-blue-600' : 'bg-gray-700'}`}>中文</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-3 py-1 rounded ${i18n.language === 'en' ? 'bg-blue-600' : 'bg-gray-700'}`}>EN</button>
        </div>

        {/* 游戏教程按钮 */}
        <div className="absolute top-8 right-8 flex flex-col gap-3">
          <button 
            onClick={() => setShowTutorial(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transition-colors border-2 border-blue-400"
          >
            {t('menu.tutorial')}
          </button>
          <button 
            onClick={() => setShowAcademy(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transition-colors border-2 border-amber-400"
          >
            {t('menu.academy')}
          </button>
          <button 
            onClick={() => setShowDeckBuilder(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-full font-bold shadow-lg transition-colors border-2 border-purple-400"
          >
            {t('menu.deckBuilder')}
          </button>
        </div>

        <h1 className="text-6xl font-black mb-8 tracking-widest text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">{t('menu.title')}</h1>
        
        <div className="flex gap-4 mb-8">
          <button onClick={() => setGameMode('ai')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'ai' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{t('menu.singlePlayer')}</button>
          <button onClick={() => setGameMode('campaign')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'campaign' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{t('menu.campaign')}</button>
          <button onClick={() => setGameMode('multiplayer')} className={`px-8 py-2 rounded font-bold transition-all ${gameMode === 'multiplayer' ? 'bg-amber-600 text-white border-2 border-amber-400' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>{t('menu.multiplayer')}</button>
        </div>

        <div className="flex gap-16 bg-black/50 p-12 rounded-2xl border-4 border-gray-700 shadow-2xl relative w-full max-w-5xl justify-center">
          {gameMode === 'campaign' ? (
            <div className="flex flex-col gap-4 w-full">
              <h2 className="text-2xl font-bold mb-4 text-center">{t('menu.selectCampaign')}</h2>
              <div className="grid grid-cols-2 gap-6">
                {getCampaignScenarios().map(sc => (
                  <button key={sc.id} onClick={() => setSelectedCampaign(sc.id)} className={`p-6 rounded-xl text-left transition-all flex flex-col gap-3 ${selectedCampaign === sc.id ? 'bg-red-900/80 border-2 border-red-500 shadow-[0_0_15px_red] scale-105' : 'bg-gray-800 border-2 border-gray-700 hover:bg-gray-700'}`}>
                    <h3 className="text-2xl font-black text-amber-500">{sc.name}</h3>
                    <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">{sc.description}</p>
                    <div className="mt-auto pt-4 border-t border-gray-600 flex justify-between text-xs font-bold text-gray-400">
                       <span>{t('menu.ally')}{sc.playerFaction}</span>
                       <span>{t('menu.enemy')}{sc.aiFaction}</span>
                       <span>{t('menu.timeLimit')}{sc.maxTurns}{t('menu.turns')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-4">{t('menu.selectFaction')}</h2>
                <div className="flex flex-col gap-3">
                  {Object.values(Faction).map(f => (
                    <button 
                      key={f} onClick={() => {
                        setPlayerFaction(f);
                        if (gameMode === 'multiplayer' && !networkManager.isHost && networkManager.conn) {
                          let deckCounts = {};
                          try { deckCounts = JSON.parse(localStorage.getItem('customDecks') || '{}')[f] || {}; } catch(e) {}
                          networkManager.send({ type: 'GUEST_READY', faction: f, deckCounts });
                        }
                        if (gameMode === 'multiplayer' && networkManager.isHost && networkManager.conn) {
                          networkManager.send({ type: 'HOST_INFO', faction: f });
                        }
                      }}
                      className={`px-8 py-3 rounded font-bold transition-all ${playerFaction === f ? 'bg-red-700 text-white border-2 border-red-400 scale-110' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col items-center">
                <h2 className="text-2xl font-bold mb-4">{gameMode === 'ai' ? t('menu.selectEnemyFaction') : t('menu.multiplayerLobby')}</h2>
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
                      <button onClick={() => { setIsHost(true); networkManager.initHost(); }} className={`flex-1 py-2 text-sm rounded font-bold ${isHost ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{t('menu.createRoom')}</button>
                      <button onClick={() => setIsHost(false)} className={`flex-1 py-2 text-sm rounded font-bold ${!isHost ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{t('menu.joinRoom')}</button>
                    </div>
                    
                    {isHost ? (
                      <div className="text-center text-gray-300 text-sm p-4 bg-black/40 rounded border border-gray-700 min-h-[100px] flex items-center justify-center break-all">
                        {connectionStatus || t('menu.generateCodePrompt')}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          placeholder={t('menu.enterCodePrompt')} 
                          value={roomId}
                          onChange={e => setRoomId(e.target.value)}
                          className="bg-black/50 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                        />
                        <button 
                          onClick={() => { networkManager.initClient(roomId); setConnectionStatus(t('menu.connecting')); }}
                          className="bg-green-600 hover:bg-green-500 text-white py-2 rounded text-sm font-bold transition-colors"
                        >
                          {t('menu.connectHost')}
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
            {t('menu.enterBattlefield')}
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
                      <li>{t('menu.rules.rule4_1')}<strong>{t('game.mySupportLine')}</strong> -&gt; <strong>{t('game.frontline')}</strong> -&gt; <strong>{t('game.enemySupportLine')}</strong>{t('menu.rules.rule4_2')}</li>
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

  // 阻止联机客机在不是自己回合时的误触
  const canInteract = () => {
    if (gameMode === 'multiplayer') {
      if (networkManager.isHost) {
        return game?.currentPlayer === game?.player1;
      } else {
        // 在客机视角中，player2 才是客机自己（因为 game state 是主机下发的，p1 是主机，p2 是客机）
        return game?.currentPlayer.name === game?.player2.name;
      }
    }
    return game?.currentPlayer === game?.player1;
  };

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
    } else if (cardId.includes('v2') || cardId.includes('manhattan') || cardId.includes('v1')) {    
      setOrderVfx({ type: 'nuke', area: isP1 ? 'p2-hq' : 'p1-hq' });       
      setGlobalShake(cardId.includes('v1') ? 30 : 50);
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
    AudioEngine.playAttackSound(attacker.category === UnitCategory.ARTILLERY, attacker.category === UnitCategory.AIR_FORCE);
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
        AudioEngine.playDamageSound();
      } else if (defDamage === 0) {
        if (typeof defender !== 'string' && defender.keywords.includes(Keyword.HEAVY_ARMOR) && attacker.category !== UnitCategory.ARTILLERY) {
           spawnAndSyncVfx('armor', '格挡', defId);
        } else if (attacker.category === UnitCategory.ARTILLERY) {
           // 炮兵造成的 0 伤害被视为“未命中” (落空)
           spawnAndSyncVfx('armor', '未命中', defId);
        }
      }
      
      if (atkDamage > 0) {
        spawnAndSyncVfx('damage', `-${atkDamage}`, attacker.id);
        AudioEngine.playDamageSound();
      }

      if (defHpAfter <= 0 && typeof defender !== 'string') {
        spawnAndSyncVfx('death', '', defId);
        AudioEngine.playDeathSound();
      }
      if (atkHpAfter <= 0) {
        spawnAndSyncVfx('death', '', attacker.id);
        AudioEngine.playDeathSound();
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
    AudioEngine.playRadioSound();
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
            showToast(t('game.infantryCannotAttackAir'));
            setSelectedBoardUnit(null);
            return;
          }

          const hasAirborneStrike = attacker.exclusiveName === '空降奇袭' || attacker.exclusiveName === 'Airborne Strike' || attacker.exclusiveName === '天降奇兵';

          // 射程验证
          if (attacker.category !== UnitCategory.ARTILLERY && attacker.category !== UnitCategory.AIR_FORCE && !hasAirborneStrike) {
             if (attacker.line === 'support' && defender.line === 'support') {
                 showToast(t('game.meleeSupportLineTarget'));
                 return;
             }
          }

          // 守护验证：如果敌方场上有守护单位，且目标不是守护单位，则必须先攻击守护单位（除非有空降奇袭）
          const guards = p2.board.filter(u => u.keywords.includes(Keyword.GUARD));
          if (guards.length > 0 && !defender.keywords.includes(Keyword.GUARD) && !hasAirborneStrike) {
              showToast(t('game.mustDestroyGuardUnitsFirst'));
              return;
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
        const hasAirborneStrike = attacker.exclusiveName === '空降奇袭' || attacker.exclusiveName === 'Airborne Strike' || attacker.exclusiveName === '天降奇兵';

        // 射程验证
        if (attacker.category !== UnitCategory.ARTILLERY && attacker.category !== UnitCategory.AIR_FORCE && !hasAirborneStrike) {
           if (attacker.line === 'support') {
               showToast(t('game.mustEnterFrontlineToAttackHq'));
               return;
           }
        }
        
        // 守护验证
        const guards = p2.board.filter(u => u.keywords.includes(Keyword.GUARD));
        if (guards.length > 0 && !hasAirborneStrike) {
            showToast(t('game.mustDestroyGuardUnitsFirst'));
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
         if (p1.cp < unit.moveCost) showToast(t('game.notEnoughCp'));
         else showToast(t('game.cannotMoveEnemyControl'));
      }
    }
  };

  const renderUnit = (unit: UnitCard, owner: 'p1'|'p2', i: number) => {
    const isAttacker = attackAnim?.attackerId === unit.id;
    const isDefender = attackAnim?.defenderId === unit.id && attackAnim.phase === 'strike';
    const isP1 = owner === 'p1';

    let effectiveCard = unit;
    if (game) {
       const effectiveStats = KeywordEngine.getEffectiveStats(unit, isP1 ? p1 : p2);
       effectiveCard = { ...unit, attack: effectiveStats.attack, defense: effectiveStats.defense };
    }

    return (
      <motion.div 
        key={unit.id} layout
        initial={{ opacity: 0, scale: 1.2, y: isP1 ? -100 : 100, filter: 'drop-shadow(0 30px 20px rgba(0,0,0,0.8))' }}
        animate={{ 
          opacity: 1, 
          y: isAttacker ? (attackAnim.phase === 'windup' ? (isP1 ? 40 : -40) : (isP1 ? -150 : 150)) : (isDefender ? [-10, 10, -10, 10, 0] : 0),
          x: isDefender ? [-10, 10, -10, 10, 0] : 0,
          scale: isAttacker ? (attackAnim.phase === 'windup' ? 1.1 : 1.3) : (isDefender ? 0.9 : 1),
          filter: isDefender ? 'brightness(3) sepia(1) hue-rotate(-50deg) saturate(5) drop-shadow(0 0 30px red)' : 'drop-shadow(0 5px 5px rgba(0,0,0,0.5))',
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
          card={effectiveCard} 
          onClick={() => handleBoardUnitClick(owner, i)}
          isSelected={selectedBoardUnit?.player === owner && selectedBoardUnit.index === i}
          canPlay={owner === 'p1' ? game.currentPlayer === p1 : (game.currentPlayer === p1 && selectedBoardUnit?.player === 'p1')} 
        />
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col font-sans overflow-x-hidden overflow-y-auto relative crt-filter crt-flicker">
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
              `}>
                <TypewriterText text={log.message} />
              </div>
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
            <h1 className={`text-9xl font-black italic tracking-widest drop-shadow-[0_0_30px_rgba(0,0,0,1)] uppercase -rotate-6 ${turnBanner === t('game.enemyTurn') ? 'text-red-600' : 'text-blue-500'}`}>
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
        className="bg-gray-800 p-2 border-b-4 border-gray-700 flex justify-between items-center shadow-lg z-10 relative">
        <div className="flex items-center gap-4">
          {/* 敌方指挥官 */}
          {p2.commander && (
            <div className="w-12 h-12 bg-gray-900 rounded-full border-2 border-red-700 flex items-center justify-center flex-col shadow-lg overflow-hidden group relative">
              <span className="text-[9px] font-bold text-gray-400 group-hover:hidden text-center">{p2.commander.name.split('·').pop()}</span>
              <div className="absolute inset-0 bg-black/90 hidden group-hover:flex flex-col items-center justify-center p-1">
                <span className="text-[7px] text-amber-400 font-bold">{p2.commander.passiveName}</span>
                <span className="text-[7px] text-blue-400 font-bold mt-1">{p2.commander.activeName}</span>
              </div>
            </div>
          )}
          <div id="p2-hq">
            <h2 className="text-lg font-bold text-gray-300">{p2.name} - {p2.faction}</h2>
            <div className="flex gap-4 mt-1 text-xs">
              <span className="bg-red-900 px-2 py-0.5 rounded-full font-bold">HQ 血量: {p2.hqHp} / 25</span>
              <span className="bg-blue-900 px-2 py-0.5 rounded-full">指挥点: {p2.cp} / {p2.maxCp}</span>
              <span className="bg-gray-700 px-2 py-0.5 rounded-full">手牌数: {p2.hand.length}</span>
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

      <motion.div className="flex-grow flex flex-col relative p-2 gap-1 bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')] min-h-[400px]"
        animate={ globalShake > 0 ? { x: [-globalShake, globalShake, -globalShake, globalShake, 0], y: [-globalShake, globalShake, -globalShake, globalShake, 0] } : {} } transition={{ duration: 0.3 }}>
        <div className="pointer-events-none fixed inset-0 shadow-[inset_0_0_300px_rgba(0,0,0,1)] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay z-40"></div>

        {/* 敌方支援战线 */}
        <div className="flex-1 flex items-center justify-center gap-4 w-full border-b-2 border-dashed border-red-900/50 relative">
          <div className="absolute top-2 left-4 text-red-700/40 font-black text-3xl pointer-events-none">{t('game.enemySupportLine')}</div>
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
        <div className="flex-1 flex flex-col justify-center gap-4 w-full bg-red-900/20 border-y-4 border-red-700 relative py-4 shadow-[inset_0_0_50px_rgba(255,0,0,0.2)]">
          <div className="absolute inset-0 flex items-center justify-center text-red-500/10 font-black text-6xl tracking-widest pointer-events-none uppercase">{t('game.frontline')}</div>
          
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
          <div className="absolute bottom-2 left-4 text-blue-700/40 font-black text-3xl pointer-events-none">{t('game.mySupportLine')}</div>
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
                {canInteract() && p1.cp >= p1.commander.activeCost && (
                  <button 
                    onClick={() => {
                       if (gameMode === 'multiplayer' && !isHost) {
                         networkManager.send({ type: 'USE_SKILL' });
                         return;
                       }
                       p1.cp -= p1!.commander!.activeCost;
                       p1.commander!.useActive(game, p1);
                       showToast(t('game.cmdSkill', { skill: p1.commander!.activeName }));
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
              <h2 className="text-xl font-bold text-white">{p1.name} - {p1.faction}</h2>
              <div className="flex gap-4 mt-1 text-xs">
                <span className="bg-red-900 px-2 py-0.5 rounded-full font-bold shadow-inner">HQ 血量: {p1.hqHp} / 25</span>
                <span className="bg-blue-900 px-2 py-0.5 rounded-full font-bold shadow-inner">指挥点(CP): <span className="text-yellow-400 text-sm">{p1.cp}</span> / {p1.maxCp}</span>
                <span className="bg-gray-700 px-2 py-0.5 rounded-full">牌库剩余: {p1.deck.length}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <button onClick={() => setShowLogs(!showLogs)} className="mb-2 text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-full border border-gray-500 transition-colors">
               {showLogs ? '隐藏日志' : '📜 查看对战日志'}
             </button>
             <div className={`text-lg font-bold mb-1 ${game.currentPlayer === p1 ? 'text-green-400' : 'text-gray-500'}`}>
                    {t('game.turn')}{game.turnNumber} : {game.currentPlayer.name}{t('game.sTurn')}
                   {game.maxTurns !== Infinity && <span className="ml-4 text-red-400 text-xs">{t('game.campaignLimit', { turns: game.maxTurns - game.currentRound + 1 })}</span>}
                 </div>
             <button onClick={handleEndTurn} disabled={!canInteract()}
               className={`font-bold py-2 px-6 rounded-xl border-b-4 transition-all text-sm ${canInteract() ? 'bg-yellow-600 hover:bg-yellow-500 border-yellow-800 text-white active:border-b-0 active:translate-y-1' : 'bg-gray-700 text-gray-500 border-gray-900 cursor-not-allowed'}`}
             >
               {canInteract() ? t('game.endTurn') : (gameMode === 'multiplayer' ? t('game.waitingOpponent') : t('game.aiThinking'))}
             </button>
          </div>
        </div>

        <div className="flex justify-center -mb-4 overflow-visible pb-4 pt-2 px-4 h-36">
          <AnimatePresence>
            {p1.hand.map((card, i) => {
              const mid = (p1.hand.length - 1) / 2;
              const angle = (i - mid) * 8;
              const yOffset = Math.abs(i - mid) * 12;
              return (
              <motion.div key={card.id} layout 
                initial={{ y: 300, opacity: 0, scale: 0.5 }} 
                animate={{ y: yOffset, rotate: angle, opacity: hiddenHandIndex === i ? 0 : 1, scale: 0.85 }} 
                exit={{ y: -200, opacity: 0, scale: 0 }} 
                transition={{ duration: 0.3 }}
                whileHover={{ y: -30, rotate: 0, scale: 0.95, zIndex: 40 }}
                drag={canInteract() && p1.cp >= card.deployCost} dragSnapToOrigin onDragEnd={(e, info) => handleDragEnd(e, info, i, card)} whileDrag={{ scale: 1, zIndex: 50, rotate: 0 }}
                className={`relative origin-bottom -mx-3 ${canInteract() && p1.cp >= card.deployCost ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'}`}
              ><CardComponent card={card} canPlay={canInteract() && p1.cp >= card.deployCost} /></motion.div>
            )})}
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
           const scenario = getCampaignScenarios().find(c => c.id === selectedCampaign);
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
            <h1 className="text-6xl font-bold text-red-500 mb-4 tracking-widest drop-shadow-lg">{isVictory ? t('game.victory') : t('game.defeat')}</h1>
            {isTimeOut && <p className="text-xl text-yellow-500 mb-4 font-bold">{t('game.timeUp')}</p>}
              {isVictory && gameMode === 'campaign' && (
                <p className="text-2xl text-green-400 mb-8 font-bold animate-pulse">{t('game.campaignVictory')}</p>
              )}
            <button onClick={() => window.location.reload()} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-12 rounded-xl border-b-4 border-yellow-800 text-2xl transition-transform hover:-translate-y-1 active:translate-y-1 active:border-b-0 mt-4">{t('game.restart')}</button>
          </div>
        );
      })()}
    </div>
  );
}
