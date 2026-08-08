import { Player } from './Player';
import { UnitCard } from './types';

export class Game {
  public player1: Player;
  public player2: Player;
  public currentPlayer: Player;
  public turnNumber: number = 0;

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
  }

  // 移动单位
  public moveUnit(player: Player, unitIndex: number) {
    const unit = player.board[unitIndex];
    if (!unit) return;

    if (unit.hasMovedThisTurn) {
      console.log(`单位 [${unit.name}] 本回合已经移动过了！`);
      return;
    }

    if (player.cp < unit.moveCost) {
      console.log(`指挥点不足！移动 [${unit.name}] 需要 ${unit.moveCost} 点，当前仅有 ${player.cp} 点。`);
      return;
    }

    player.cp -= unit.moveCost;
    unit.hasMovedThisTurn = true;
    console.log(`[${unit.name}] 进行了移动，消耗了 ${unit.moveCost} 点指挥点。剩余 CP: ${player.cp}`);
  }

  // 战斗结算
  public attackUnit(attacker: UnitCard, defender: UnitCard, attackerOwner: Player, defenderOwner: Player) {
    if (attacker.hasAttackedThisTurn) {
      console.log(`[${attacker.name}] 本回合已经攻击过了！`);
      return;
    }

    console.log(`\n[战斗] ${attacker.name}(攻:${attacker.attack}) 攻击 ${defender.name}(防:${defender.defense}, 血:${defender.hp})`);
    
    const atk = attacker.attack;
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

    if (defender.hp <= 0) {
      console.log(`=> ${defender.name} 阵亡！`);
      this.destroyUnit(defenderOwner, defender);
    }
  }

  // 攻击敌方总部
  public attackHQ(attacker: UnitCard, defenderPlayer: Player) {
    if (attacker.hasAttackedThisTurn) {
      console.log(`[${attacker.name}] 本回合已经攻击过了！`);
      return;
    }

    console.log(`\n[战斗] ${attacker.name}(攻:${attacker.attack}) 攻击了 ${defenderPlayer.name} 的总部！`);
    defenderPlayer.takeHqDamage(attacker.attack);
    attacker.hasAttackedThisTurn = true;
  }

  // 单位阵亡处理
  private destroyUnit(player: Player, unit: UnitCard) {
    const index = player.board.indexOf(unit);
    if (index !== -1) {
      player.board.splice(index, 1);
      player.graveyard.push(unit);
    }
  }
}
