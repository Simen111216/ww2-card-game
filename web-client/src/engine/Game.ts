import { Player } from './Player';
import { UnitCategory, Keyword, type UnitCard, type EnvironmentCard } from './types';

export class Game {
  public player1: Player;
  public player2: Player;
  public currentPlayer: Player;
  public turnNumber: number = 0;
  public activeEnvironment: EnvironmentCard | null = null;

  constructor(player1: Player, player2: Player) {
    this.player1 = player1;
    this.player2 = player2;
    this.currentPlayer = this.player2; // 设为P2，这样第一次 nextTurn 就会切给 P1
  }

  public startGame() {
    console.log("=== 游戏开始 ===");
    // 初始抽5张牌
    this.player1.drawCard(5);
    this.player2.drawCard(5);
    
    this.nextTurn();
  }

  public nextTurn() {
    this.turnNumber++;
    this.currentPlayer = this.currentPlayer === this.player1 ? this.player2 : this.player1;
    console.log(`\n=== 第 ${this.turnNumber} 回合 : ${this.currentPlayer.name} 的回合 ===`);
    this.currentPlayer.startTurn();

    // 触发环境卡的每回合效果
    if (this.activeEnvironment && this.activeEnvironment.onTurnStart) {
      this.activeEnvironment.onTurnStart(this);
    }

    // 触发指挥官的被动（需要game上下文）
    if (this.currentPlayer.commander && this.currentPlayer.commander.onTurnStart) {
      this.currentPlayer.commander.onTurnStart(this, this.currentPlayer);
    }
  }

  // 移动单位
  public moveUnit(player: Player, opponent: Player, unit: UnitCard): boolean {
    if (unit.hasMovedThisTurn) return false;
    if (unit.line === 'frontline') return false;
    if (player.cp < unit.moveCost) {
        console.log("CP不足，无法移动");
        return false;
    }
    
    // 检查敌方前线是否有单位
    const enemyFrontline = opponent.board.filter(u => u.line === 'frontline');
    if (enemyFrontline.length > 0) {
      console.log("敌方前线有单位，必须先消灭才能进入前线！");
      return false;
    }
    
    player.cp -= unit.moveCost;
    unit.line = 'frontline';
    unit.hasMovedThisTurn = true;
    console.log(`${unit.name} 推进到了前线！`);
    return true;
  }

  // 战斗结算
  public attackUnit(attacker: UnitCard, defender: UnitCard, attackerOwner: Player, defenderOwner: Player): boolean {
    if (attacker.hasAttackedThisTurn) {
      console.log(`[${attacker.name}] 本回合已经攻击过了！`);
      return false;
    }

    if (attacker.category === UnitCategory.INFANTRY && defender.category === UnitCategory.AIR_FORCE) {
      console.log(`规则限制：步兵 [${attacker.name}] 无法攻击空军 [${defender.name}]！`);
      return false;
    }

    console.log(`\n[战斗] ${attacker.name}(攻:${attacker.attack}) 攻击 ${defender.name}(防:${defender.defense}, 血:${defender.hp})`);
    
    let atk = attacker.attack;
    if (defender.keywords.includes(Keyword.HEAVY_ARMOR)) {
      atk = Math.max(0, atk - 2);
      console.log(`-> [重甲] 免疫了2点伤害，实际承受攻击力为 ${atk}`);
    }

    if (atk <= defender.defense) {
      defender.defense -= atk;
      console.log(`-> 攻击力(${atk}) 小于等于 防御力。防御力减少 ${atk}，剩余防御: ${defender.defense}，血量未受损。`);
    } else {
      const damageToHp = atk - defender.defense;
      console.log(`-> 攻击力(${atk}) 大于 防御力(${defender.defense})。防御力被清零！`);
      defender.defense = 0;
      defender.hp -= damageToHp;
      console.log(`-> 造成了 ${damageToHp} 点血量伤害，${defender.name} 剩余血量: ${defender.hp}`);
    }

    attacker.hasAttackedThisTurn = true;

    if (defender.hp > 0 && defender.keywords.includes(Keyword.AMBUSH)) {
      console.log(`-> [伏击] ${defender.name} 触发伏击，对 ${attacker.name} 造成反击！`);
      let counterAtk = defender.attack;
      if (attacker.keywords.includes(Keyword.HEAVY_ARMOR)) {
        counterAtk = Math.max(0, counterAtk - 2);
        console.log(`   -> [重甲] 攻击方免疫了2点反击伤害，实际反击力为 ${counterAtk}`);
      }
      if (counterAtk <= attacker.defense) {
        attacker.defense -= counterAtk;
      } else {
        attacker.hp -= (counterAtk - attacker.defense);
        attacker.defense = 0;
      }
      if (attacker.hp <= 0) {
        console.log(`=> 伏击导致 ${attacker.name} 阵亡！`);
        this.destroyUnit(attackerOwner, attacker);
      }
    }

    if (defender.hp <= 0) {
      console.log(`=> ${defender.name} 阵亡！`);
      this.destroyUnit(defenderOwner, defender);
    }
    
    return true;
  }

  // 攻击敌方总部
  public attackHQ(attacker: UnitCard, defenderPlayer: Player): boolean {
    if (attacker.hasAttackedThisTurn) {
      console.log(`[${attacker.name}] 本回合已经攻击过了！`);
      return false;
    }

    const guards = defenderPlayer.board.filter(u => u.keywords.includes(Keyword.GUARD));
    if (guards.length > 0) {
      console.log("必须先消灭具有【守护】的单位，才能攻击总部！");
      return false;
    }

    console.log(`\n[战斗] ${attacker.name}(攻:${attacker.attack}) 攻击了 ${defenderPlayer.name} 的总部！`);
    defenderPlayer.takeHqDamage(attacker.attack);
    attacker.hasAttackedThisTurn = true;
    return true;
  }

  // 单位阵亡处理
  private destroyUnit(player: Player, unit: UnitCard) {
    const index = player.board.findIndex(u => u.id === unit.id);
    if (index !== -1) {
      player.board.splice(index, 1);
      player.graveyard.push(unit);
    }
  }

  public serialize() {
    return {
      turnNumber: this.turnNumber,
      currentPlayer: this.currentPlayer === this.player1 ? 'p1' : 'p2',
      activeEnvironment: this.activeEnvironment,
      p1: {
        hqHp: this.player1.hqHp,
        cp: this.player1.cp,
        maxCp: this.player1.maxCp,
        hand: this.player1.hand, // Array of cards
        board: this.player1.board,
        deckCount: this.player1.deck.length,
        commander: this.player1.commander
      },
      p2: {
        hqHp: this.player2.hqHp,
        cp: this.player2.cp,
        maxCp: this.player2.maxCp,
        hand: this.player2.hand,
        board: this.player2.board,
        deckCount: this.player2.deck.length,
        commander: this.player2.commander
      }
    };
  }
}
