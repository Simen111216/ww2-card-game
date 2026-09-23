import { Game } from './Game';
import { Player } from './Player';
import { UnitCategory, Keyword, Faction, CardType, type UnitCard } from './types';
import { AudioEngine } from './AudioEngine';

export class KeywordEngine {
  // 1. 部署时触发 (onDeploy)
  public static onDeploy(unit: UnitCard, game: Game, owner: Player) {
    switch (unit.exclusiveId) {
      case 'soviet_6': // 钢铁壁垒 (KV-1)
      case 'german_6': // 陆上霸主 (虎式)
      case 'adv_2':    // 帝国终焉 (虎王)
        game.addLog(owner.name, `[${unit.name}] 触发专属词条，嘲讽全场！`, 'skill');
        AudioEngine.playMetalClangSound();
        if (!unit.keywords.includes(Keyword.GUARD)) {
          unit.keywords.push(Keyword.GUARD);
        }
        break;
      case 'soviet_7': // 柏林先锋 (IS-2)
        game.addLog(owner.name, `[${unit.name}] 触发【柏林先锋】，获得护盾！`, 'skill');
        AudioEngine.playMetalClangSound();
        unit.hasShield = true;
        break;
      case 'adv_3': // 天降奇兵 (101空降师)
      case 'uk_2':  // 空降奇袭 (红魔伞兵)
      case 'usa_2': // 丛林利刃 (游骑兵)
      case 'adv_4': // 暗夜绝杀 (SAS特种空勤团)
      case 'german_11': // 空降突袭 (德军伞兵)
        game.addLog(owner.name, `[${unit.name}] 奇袭入场！无视敌方守护！`, 'skill');
        AudioEngine.playSwooshSound();
        break;
      case 'usa_4': // 后期王牌 (M26 潘兴)
        game.addLog(owner.name, `[${unit.name}] 触发【后期王牌】，清除了我方所有负面效果！`, 'skill');
        owner.board.forEach(u => u.burnStacks = 0);
        break;
      case 'france_3': // 快速穿插 (S35 骑兵坦克)
        game.addLog(owner.name, `[${unit.name}] 触发【快速穿插】，直接突进前线！`, 'skill');
        unit.line = 'frontline';
        break;
      case 'usa_8': // 空投支援 (美军空降兵)
        game.addLog(owner.name, `[${unit.name}] 触发【空投支援】，召唤大兵！`, 'skill');
        const giToken: UnitCard = {
          ...unit,
          id: Math.random().toString(36).substring(7),
          exclusiveId: 'usa_1', 
          name: '大兵(G.I.)',
          hp: 4, maxHp: 4, attack: 3, defense: 2, cost: 1,
          hasAttackedThisTurn: true,
          hasMovedThisTurn: true
        };
        owner.board.push(giToken);
        break;
      case 'uk_11': // 隐身突袭 (蚊式轰炸机)
        game.addLog(owner.name, `[${unit.name}] 触发【隐身突袭】，首回合免疫防空锁定！`, 'skill');
        unit.stealthThisTurn = true;
        break;
      case 'adv_8': // 全域空降 (82空降师)
        game.addLog(owner.name, `[${unit.name}] 触发【全域空降】，突袭入场！`, 'skill');
        AudioEngine.playSwooshSound();
        break;
    }
  }

  // 2. 死亡时触发 (onDeath)
  public static onDeath(unit: UnitCard, game: Game, owner: Player) {
    // 浴血卫国 (斯大林格勒近卫师) - 友军阵亡加属性
    owner.board.filter(u => u.exclusiveId === 'adv_1').forEach(u => {
      if (u !== unit) {
        u.attack += 1;
        u.maxHp += 1;
        u.hp += 1;
        game.addLog(owner.name, `[${u.name}] 触发【浴血卫国】，因友军阵亡全属性提升！`, 'skill');
      }
    });

    switch (unit.exclusiveId) {
      case 'soviet_1': // 人海
        game.addLog(owner.name, `[${unit.name}] 阵亡，触发【人海】免费召唤一名动员兵！`, 'skill');
        const token: UnitCard = {
          ...unit,
          id: Math.random().toString(36).substring(7),
          exclusiveId: undefined, 
          exclusiveName: undefined,
          exclusiveDesc: undefined,
          hp: unit.maxHp,
          hasAttackedThisTurn: true,
          hasMovedThisTurn: true
        };
        owner.board.push(token);
        break;
      case 'soviet_4': // 量产铁军
      case 'soviet_5': // 攻坚改良
        game.addLog(owner.name, `[${unit.name}] 阵亡，触发量产特性，返还 2 点 CP！`, 'skill');
        owner.cp += 2;
        break;
      case 'german_1': // 决死
        game.addLog(owner.name, `[${unit.name}] 阵亡，【决死】生效，全体友军士气大振！`, 'skill');
        break;
      case 'adv_2': // 帝国终焉
        game.addLog(owner.name, `[${unit.name}] 阵亡，【帝国终焉】反噬，掉落 2 点 CP。`, 'skill');
        owner.cp = Math.max(0, owner.cp - 2);
        break;
      case 'usa_1': // 后勤充沛 (G.I.大兵)
        if (Math.random() > 0.5) {
           game.addLog(owner.name, `[${unit.name}] 阵亡，【后勤充沛】触发，免费重生！`, 'skill');
           const token: UnitCard = {
             ...unit,
             id: Math.random().toString(36).substring(7),
             hp: unit.maxHp,
             hasAttackedThisTurn: true,
             hasMovedThisTurn: true
           };
           owner.board.push(token);
        }
        break;
      case 'adv_6': // 钢铁防线 (近卫反坦克连)
        game.addLog(owner.name, `[${unit.name}] 阵亡，【钢铁防线】触发，留下反坦克地雷！`, 'skill');
        const mine: UnitCard = {
          id: `mine-${Math.random().toString(36).substring(7)}`,
          name: '反坦克地雷',
          type: CardType.UNIT, category: UnitCategory.INFANTRY, faction: Faction.SOVIET,
          cost: 0, attack: 10, defense: 1, hp: 1, maxHp: 1, moveCost: 0,
          keywords: [Keyword.AMBUSH], exclusiveId: 'token_mine',
          hasMovedThisTurn: true, hasAttackedThisTurn: true, line: 'support',
          desc: '对装甲单位造成毁灭性打击'
        };
        owner.board.push(mine);
        break;
    }
  }

  // 3. 回合开始时触发 (onTurnStart)
  public static onTurnStart(game: Game, player: Player) {
    const opponent = game.currentPlayer === game.player1 ? game.player2 : game.player1;

    player.board.forEach(unit => {
      // 重置隐身状态
      if (unit.stealthThisTurn) {
        unit.stealthThisTurn = false;
      }

      // uk_4: 丘吉尔 免疫灼烧 / uk_9: 马蒂尔达 免疫灼烧
      if (unit.exclusiveId === 'uk_4' || unit.exclusiveId === 'uk_9') {
        if (unit.burnStacks && unit.burnStacks > 0) {
          unit.burnStacks = 0;
          game.addLog(player.name, `[${unit.name}] 装甲极厚，免疫了灼烧伤害！`, 'skill');
        }
      }

      // 灼烧结算
      if (unit.burnStacks && unit.burnStacks > 0) {
        unit.hp -= unit.burnStacks;
        game.addLog(player.name, `[${unit.name}] 受到 ${unit.burnStacks} 点灼烧伤害！`, 'system');
        unit.burnStacks--;
      }

      // german_4: 机动补给 (半履带车) - 简化的群疗效果
      if (unit.exclusiveId === 'german_4') {
        const pBoard = player.board;
        let healed = false;
        pBoard.forEach(u => {
          if (u.hp < u.maxHp) {
            u.hp = Math.min(u.maxHp, u.hp + 2);
            healed = true;
          }
        });
        if (healed) {
          game.addLog(player.name, `[${unit.name}] 触发【机动补给】，治愈了友军。`, 'skill');
          AudioEngine.playHealSound();
        }
      }

      // usa_5: 持续压制 (M7牧师)
      if (unit.exclusiveId === 'usa_5') {
        game.addLog(player.name, `[${unit.name}] 触发【持续压制】，轰炸敌方后排！`, 'skill');
        opponent.board.filter(u => u.line === 'support').forEach(u => u.hp -= 1);
      }

      // soviet_3: 督战 (政委) - 每回合可让1个残血友军步兵单位立即行动一次
      if (unit.exclusiveId === 'soviet_3') {
        const lowHpInfantry = player.board.find(u => u.category === UnitCategory.INFANTRY && u.hp <= Math.floor(u.maxHp / 2) && u !== unit);
        if (lowHpInfantry) {
           // 给予一个临时标记，让它本回合可以攻击两次
           (lowHpInfantry as any).extraAttackGranted = true;
           game.addLog(player.name, `[${unit.name}] 触发【督战】，让残血的 [${lowHpInfantry.name}] 狂热，本回合可额外行动一次！`, 'skill');
           AudioEngine.playWhistleSound();
        }
      }

      // 阵地压制 (BT-7 快速坦克变种逻辑 / 150mm重炮)
      if (unit.exclusiveId === 'soviet_12') {
         // 这里可以叠加压制层数
      }
      
      if (unit.exclusiveId === 'german_13') { // 150mm 重榴弹炮
         if (!unit.chargeStacks) unit.chargeStacks = 0;
         unit.chargeStacks += 1;
         if (unit.chargeStacks >= 2) {
            game.addLog(player.name, `[${unit.name}] 触发【重炮洗地】，全屏范围伤害！`, 'skill');
            AudioEngine.playAttackSound(true);
            opponent.board.forEach(u => {
               u.hasShield = false; // 摧毁护盾
               u.hp -= 3;
            });
            opponent.board = opponent.board.filter(u => u.hp > 0);
            unit.chargeStacks = 0;
         } else {
            game.addLog(player.name, `[${unit.name}] 正在蓄力【重炮洗地】...`, 'skill');
         }
      }
    });
  }

  // 获取面板最终属性 (计算光环)
  public static getEffectiveStats(unit: UnitCard, owner: Player): { attack: number, defense: number } {
    let attack = unit.attack;
    let defense = unit.defense;
    
    let humanWaveBonus = 0;
    let otherAuraBonus = 0;
    
    owner.board.forEach(u => {
      if (u.exclusiveId === 'soviet_1' && unit.deployCost <= 2) humanWaveBonus += 1; // 人海
      if (u.exclusiveId === 'soviet_3' && unit.category === UnitCategory.INFANTRY && unit.faction === Faction.SOVIET && u !== unit) otherAuraBonus += 2; // 督战 (不加成自己)
      if (u.exclusiveId === 'german_5' && unit.category === UnitCategory.ARMOR && unit.deployCost >= 4 && unit.deployCost <= 7) otherAuraBonus += 2; // 战场中坚
      if (u.exclusiveId === 'usa_3') otherAuraBonus += 1; // 工业洪流 (谢尔曼)
      if (u.exclusiveId === 'france_6' && unit.exclusiveId === 'france_6' && owner.board.some(x => x.exclusiveId === 'france_1')) otherAuraBonus += 3; // 复国雄鹰
      if (u.exclusiveId === 'adv_5' && unit.faction === Faction.FRANCE) otherAuraBonus += 2; // 光复山河 翻倍(简化为固定加成)
    });
    
    if (humanWaveBonus > 3) humanWaveBonus = 3; // 人海最多叠加3层
    
    attack += humanWaveBonus + otherAuraBonus;

    // 绝境坚守 (法国外籍军团)
    if (unit.exclusiveId === 'france_2') {
       attack += Math.max(0, 4 - owner.board.length);
    }
    
    // 固守炮击
    if (unit.exclusiveId === 'france_5' && !unit.hasMovedThisTurn) {
       attack += 2;
    }

    return { attack, defense };
  }

  // 4. 计算攻击方最终伤害 (modifyAttackDamage)
  public static modifyAttackDamage(attacker: UnitCard, defender: UnitCard | 'hq', baseDamage: number, game: Game): number {
    const owner = game.currentPlayer.board.includes(attacker) ? game.currentPlayer : (game.currentPlayer === game.player1 ? game.player2 : game.player1);
    
    // 获取面板基础属性（包含光环）
    let finalDamage = KeywordEngine.getEffectiveStats(attacker, owner).attack;

    // 针对单位的伤害修正
    if (defender !== 'hq') {
      if (attacker.exclusiveId === 'soviet_5' && defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
        finalDamage = Math.floor(finalDamage * 1.2); // 攻坚改良
      }
      if (attacker.exclusiveId === 'soviet_7' && defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
        finalDamage = Math.floor(finalDamage * 1.5); // 柏林先锋
      }
      if (attacker.exclusiveId === 'soviet_8' && defender.category === UnitCategory.ARMOR) {
        finalDamage = Math.floor(finalDamage * 1.5); // 猎甲暴击
      }
      if (attacker.exclusiveId === 'soviet_10' && defender.category !== UnitCategory.AIR_FORCE) {
        finalDamage *= 2; // 黑死神对地
      }
      if (attacker.exclusiveId === 'german_8') {
        if (defender.category === UnitCategory.AIR_FORCE && defender.deployCost <= 7) {
           finalDamage = 99; // 两用绝杀 秒杀空军
        } else if (defender.category === UnitCategory.ARMOR) {
           finalDamage = Math.floor(finalDamage * 1.5);
        }
      }
      if (attacker.exclusiveId === 'german_10') {
         finalDamage = Math.floor(finalDamage * 1.5); // 斯图卡暴击
      }
      if (attacker.exclusiveId === 'adv_4' && !attacker.hasAttackedThisTurn) { // SAS首次攻击
         if (defender.deployCost >= 6) finalDamage = 99; // 秒杀高阶
      }
      if (attacker.exclusiveId === 'usa_4' && defender.faction === Faction.GERMANY && defender.category === UnitCategory.ARMOR && defender.deployCost >= 7) {
         finalDamage += 5; // 后期王牌 对德系高阶装甲真实伤害(简化为+5)
      }
      if (attacker.exclusiveId === 'uk_5' && defender.hp <= Math.floor(defender.maxHp / 2)) {
       finalDamage += 3; // 25磅炮 锁定残血
    }
      if (attacker.exclusiveId === 'uk_6' && defender.faction === Faction.GERMANY && defender.category === UnitCategory.AIR_FORCE) {
         finalDamage = Math.floor(finalDamage * 1.5); // 英伦守护 对德系空军
      }
      if (attacker.exclusiveId === 'france_2') {
         // 场上友军越少，伤害越高 (上限+3)
         finalDamage += Math.max(0, 4 - owner.board.length);
      }
      if (attacker.exclusiveId === 'france_5' && !attacker.hasMovedThisTurn) {
         finalDamage += 2; // 固守炮击 不移动伤害提升
      }
      if (attacker.exclusiveId === 'soviet_12' && !defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
         game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【高速穿插】，对非重甲单位伤害翻倍！`, 'skill');
         finalDamage *= 2;
      }
      if (defender.category === UnitCategory.AIR_FORCE) {
         if (attacker.exclusiveId === 'soviet_13') { // Pe-2
           finalDamage += 2;
         }
      }
      
      // adv_7: 猎虎无视重甲
      if (attacker.exclusiveId === 'adv_7') {
         if (defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
            finalDamage += 4;
            game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【终极反坦】，重创敌方重甲！`, 'skill');
         }
      }
      // german_14: Fw-190
      if (attacker.exclusiveId === 'german_14' && defender.category === UnitCategory.AIR_FORCE) {
         finalDamage += 3;
      }
      // usa_9: M18地狱猫
      if (attacker.exclusiveId === 'usa_9' && defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
         finalDamage += 3;
      }
      // usa_11: P-47雷电溅射
      if (attacker.exclusiveId === 'usa_11' && defender.category !== UnitCategory.AIR_FORCE) {
         const defOwner = game.currentPlayer.board.includes(defender) ? game.currentPlayer : (game.currentPlayer === game.player1 ? game.player2 : game.player1);
         defOwner.board.forEach(u => {
           if (u !== defender && u.line === defender.line) {
             u.hp -= 1; // 溅射伤害
           }
         });
      }
      // france_9: 75mm破甲
      if (attacker.exclusiveId === 'france_9' && defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
         finalDamage += 2;
      }
    } else {
      if (attacker.exclusiveId === 'soviet_7') {
         finalDamage = Math.floor(finalDamage * 1.5); // 柏林先锋拆家
      }
    }

    return finalDamage;
  }

  // 5. 计算防御方免伤/减伤 (modifyDefenseDamageReduction)
  public static modifyDefenseDamageReduction(defender: UnitCard | 'hq', attacker: UnitCard, damage: number, game: Game): number {
    let finalDamage = damage;
    if (defender === 'hq') return finalDamage;

    if (defender.hasShield) {
      game.addLog('系统', `[${defender.name}] 的护盾抵挡了所有伤害！`, 'skill');
      defender.hasShield = false;
      return 0;
    }

    // 基础重甲判定 (-2)
    if (defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
      // german_7: 精准破甲 (无视50%重甲减免，即只减1)
      if (attacker.exclusiveId === 'german_7') {
         finalDamage = Math.max(0, finalDamage - 1);
      } else {
         finalDamage = Math.max(0, finalDamage - 2);
      }
    }

    // 专属词条判定
    if (defender.exclusiveId === 'soviet_2' && defender.hp <= Math.floor(defender.maxHp / 2)) {
      finalDamage = Math.floor(finalDamage * 0.7); // 死守 30%免伤
    }
    if (defender.exclusiveId === 'soviet_6' && (attacker.category === UnitCategory.ARTILLERY || attacker.category === UnitCategory.AIR_FORCE)) {
      finalDamage = Math.floor(finalDamage * 0.5); // 钢铁壁垒
    }
    if (defender.exclusiveId === 'soviet_10' && attacker.category !== UnitCategory.AIR_FORCE) {
      finalDamage = Math.floor(finalDamage * 0.6); // 黑死神免伤40%
    }
    if (defender.exclusiveId === 'german_6' || defender.exclusiveId === 'adv_2') {
      const maxDmg = Math.floor(defender.maxHp * 0.3);
      if (finalDamage > maxDmg) {
         game.addLog('系统', `[${defender.name}] 霸体生效，单次受伤不超过 30%！`, 'skill');
         AudioEngine.playMetalClangSound();
         finalDamage = maxDmg;
      }
    }
    if (defender.exclusiveId === 'france_2') {
      const owner = game.currentPlayer.board.includes(defender) ? game.currentPlayer : (game.currentPlayer === game.player1 ? game.player2 : game.player1);
      const reduction = Math.min(0.5, 0.1 * Math.max(0, 5 - owner.board.length));
      finalDamage = Math.floor(finalDamage * (1 - reduction)); // 绝境坚守
    }
    if (defender.exclusiveId === 'adv_5' && defender.hp <= Math.floor(defender.maxHp / 4)) {
      game.addLog('系统', `[${defender.name}] 触发光复山河，残血无敌！`, 'skill');
      AudioEngine.playMetalClangSound();
      finalDamage = 0;
    }
    if (defender.exclusiveId === 'adv_1') {
      if (finalDamage >= defender.hp && defender.hp > 1) {
         game.addLog('系统', `[${defender.name}] 触发【浴血卫国】，坚守绝境不被秒杀！`, 'skill');
         finalDamage = defender.hp - 1;
      }
    }

    // 光环减伤
    const defOwner = game.currentPlayer.board.includes(defender) ? game.currentPlayer : (game.currentPlayer === game.player1 ? game.player2 : game.player1);

    // usa_6: 全域护航
    if (attacker.exclusiveId !== 'usa_6' && !attacker.keywords.includes(Keyword.ANTI_AIR)) {
      const hasMustang = defOwner.board.some(u => u.exclusiveId === 'usa_6');
      if (hasMustang && (defender as UnitCard).category === UnitCategory.AIR_FORCE) {
        game.addLog(defOwner.name, `P-51野马提供【全域护航】，免疫非防空火力！`, 'skill');
        return 0; // 护航免伤
      }
    }
    
    // france_7: 马奇诺守备兵 (减免远程炮火)
    const hasMaginot = defOwner.board.some(u => u.exclusiveId === 'france_7');
    if (hasMaginot && attacker.category === UnitCategory.ARTILLERY) {
      finalDamage = Math.max(1, finalDamage - 2);
      game.addLog(defOwner.name, `马奇诺防线提供【壁垒坚守】，减免炮火伤害！`, 'skill');
    }
    
    // adv_8: 82空降师 (临时免伤)
    if ((defender as UnitCard).exclusiveId === 'adv_8' && (defender as any).stealthThisTurn) {
       finalDamage = Math.max(0, finalDamage - 3);
    }
    if (defOwner.board.some(u => u.exclusiveId === 'uk_1' && u.line === defender.line)) {
       finalDamage = Math.floor(finalDamage * 0.85); // 英伦防线 同排15%免伤
    }

    return finalDamage;
  }

  // 6. 攻击后触发 (afterAttack - 用于附加效果如灼烧、AOE等)
  public static afterAttack(attacker: UnitCard, defender: UnitCard | 'hq', game: Game, pDef: Player) {
    if (attacker.exclusiveId === 'soviet_9') { // 喀秋莎 火海覆盖
      game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【火海覆盖】，对敌方前排造成 AOE 灼烧！`, 'skill');
      pDef.board.filter(u => u.line === 'frontline').forEach(u => {
        if (u !== defender) { // 目标已经受过主伤害
          u.hp -= 2; 
        }
        u.burnStacks = (u.burnStacks || 0) + 1;
      });
    }
    if (attacker.exclusiveId === 'german_10' && defender !== 'hq') { // 斯图卡压制
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【尖啸俯冲】，压制了目标！`, 'skill');
       (defender as UnitCard).attack = Math.max(1, (defender as UnitCard).attack - 2);
    }
    if (attacker.exclusiveId === 'uk_3') { // 十字军 机动游击
       if (attacker.line === 'frontline') {
          attacker.line = 'support';
          game.addLog(game.currentPlayer.name, `[${attacker.name}] 攻击后后撤至支援阵线！`, 'skill');
       }
    }
    if (attacker.exclusiveId === 'uk_7') { // 兰开斯特 纵深打击
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【纵深打击】，造成大范围 AOE！`, 'skill');
       pDef.board.forEach(u => {
          if (u !== defender) u.hp -= 2;
       });
    }
    if (attacker.exclusiveId === 'france_4' && defender !== 'hq') { // B1 双线火力
       const others = pDef.board.filter(u => u !== defender);
       if (others.length > 0) {
          const target = others[Math.floor(Math.random() * others.length)];
          target.hp -= Math.max(1, attacker.attack - 2);
          game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【双线火力】，同时打击了 [${target.name}]！`, 'skill');
       }
    }
    if (attacker.exclusiveId === 'france_1' && defender !== 'hq') {
       (defender as UnitCard).hasAttackedThisTurn = true; // 变相降低攻速
       (defender as UnitCard).hasMovedThisTurn = true; // 降低移速
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 袭扰了目标，使其本回合无法移动和攻击！`, 'skill');
    }
    if (attacker.exclusiveId === 'france_8' && defender !== 'hq') { // FCM 36 游击袭扰
       (defender as UnitCard).defense = Math.max(0, (defender as UnitCard).defense - 1);
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【游击袭扰】，降低目标护甲！`, 'skill');
    }
    if (attacker.exclusiveId === 'german_12' && defender !== 'hq' && (defender as UnitCard).category === UnitCategory.ARMOR) { // 三号突击炮
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【反坦克专精】，清空目标重甲！`, 'skill');
       (defender as UnitCard).keywords = (defender as UnitCard).keywords.filter(k => k !== Keyword.HEAVY_ARMOR);
    }
    if (attacker.exclusiveId === 'uk_10' && defender !== 'hq') { // 维克斯重机枪
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【火力封锁】，压制目标！`, 'skill');
       (defender as any).suppressed = true;
    }
    if (attacker.exclusiveId === 'soviet_11' && defender !== 'hq') { // 苏军狙击手
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 触发【精准狙杀】，直接削减目标最大生命值！`, 'skill');
       const reduction = Math.floor((defender as UnitCard).maxHp * 0.3);
       (defender as UnitCard).maxHp -= reduction;
       if ((defender as UnitCard).hp > (defender as UnitCard).maxHp) {
         (defender as UnitCard).hp = (defender as UnitCard).maxHp;
       }
    }
    
    // 消耗额外攻击次数 (由政委等赋予)
    if ((attacker as any).extraAttackGranted) {
       (attacker as any).extraAttackGranted = false;
       attacker.hasAttackedThisTurn = false;
       attacker.hasMovedThisTurn = false;
       game.addLog(game.currentPlayer.name, `[${attacker.name}] 消耗狂热状态，可以再次行动！`, 'skill');
    }
  }

  // 7. 击杀后触发 (afterKill)
  public static afterKill(attacker: UnitCard, defender: UnitCard | 'hq', game: Game, owner: Player) {
    if (defender === 'hq') return;

    // Fw-190 战斗机
    if (attacker.exclusiveId === 'german_14' && defender.category === UnitCategory.AIR_FORCE) {
      game.addLog(owner.name, `[${attacker.name}] 触发【高空压制】，击落敌机，永久提升攻击力！`, 'skill');
      attacker.attack += 1;
    }

    // 空降奇袭 / 天降奇兵 / 暗夜绝杀(高级潜伏)
    if (['uk_2', 'adv_3', 'adv_4'].includes(attacker.exclusiveId || '')) {
      attacker.hasAttackedThisTurn = false;
      game.addLog(owner.name, `[${attacker.name}] 触发奇袭，击杀目标后可再次行动！`, 'skill');
      AudioEngine.playSwooshSound();
    }
    
    // 制空先锋
    if (attacker.exclusiveId === 'german_9' && defender.category === UnitCategory.AIR_FORCE) {
      attacker.hasAttackedThisTurn = false;
      game.addLog(owner.name, `[${attacker.name}] 触发【制空先锋】，击落敌机后可再次行动！`, 'skill');
    }

    // 步坦协同 回血
    if (attacker.exclusiveId === 'german_3') {
       attacker.hp = Math.min(attacker.maxHp, attacker.hp + 2);
    }
    
    // uk_6 英伦守护
    if (attacker.exclusiveId === 'uk_6' && defender.category === UnitCategory.AIR_FORCE && defender.faction === Faction.GERMANY) {
       attacker.hasShield = true;
       game.addLog(owner.name, `[${attacker.name}] 触发【英伦守护】，击落敌机获得护盾！`, 'skill');
    }
  }

  // 8. 动态目标合法性拦截 (canTarget)
  public static canTarget(attacker: UnitCard, defender: UnitCard | 'hq', game: Game, pDef: Player): { valid: boolean; reason?: string } {
    if (defender !== 'hq') {
       if (defender.exclusiveId === 'france_1' && defender.keywords.includes(Keyword.AMBUSH)) {
          return { valid: false, reason: `[${defender.name}] 处于潜伏状态，无法被锁定！` };
       }
       if (attacker.exclusiveId === 'uk_11') { // 蚊式隐身首回合
          if (defender.keywords.includes(Keyword.ANTI_AIR)) {
             return { valid: false, reason: `隐身单位无法锁定防空火力！` };
          }
       }
       if (defender.stealthThisTurn && attacker.category !== UnitCategory.ARTILLERY) {
          return { valid: false, reason: `[${defender.name}] 处于潜伏状态，无法被普攻锁定！` };
       }
    }

    if (attacker.category === UnitCategory.INFANTRY && defender !== 'hq' && defender.category === UnitCategory.AIR_FORCE) {
      return { valid: false, reason: `步兵 [${attacker.name}] 无法攻击空军 [${defender.name}]！` };
    }

    if (attacker.exclusiveId === 'usa_10' && attacker.line === 'support') { // M1迫击炮
       return { valid: true }; // 曲射覆盖，无视前排
    }

    // 处理普通守护逻辑
    const hasGuard = pDef.board.some(u => u.keywords.includes(Keyword.GUARD) && (defender === 'hq' || u.line === defender.line));
    const hasAirborne = ['uk_2', 'usa_2', 'adv_3', 'adv_4', 'soviet_11', 'german_11', 'adv_8'].includes(attacker.exclusiveId || '');
    
    if (hasGuard && !hasAirborne) {
      if (defender === 'hq' || !defender.keywords.includes(Keyword.GUARD)) {
        return { valid: false, reason: `敌方存在守护单位，必须先攻击守护单位！` };
      }
    }

    return { valid: true };
  }
}
