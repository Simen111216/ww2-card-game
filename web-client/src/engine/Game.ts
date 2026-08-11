import { Player } from './Player';
import { UnitCategory, Keyword, type UnitCard, type EnvironmentCard, type CombatLog } from './types';

export class Game {
  public player1: Player;
  public player2: Player;
  public currentPlayer: Player;
  public turnNumber: number = 0;
  public activeEnvironment: EnvironmentCard | null = null;
  public maxTurns: number = Infinity;
  public logs: CombatLog[] = [];
  public onVfx?: (type: 'damage' | 'heal' | 'armor' | 'death', text: string, targetId: string) => void;

  public get currentRound() {
    return Math.ceil(this.turnNumber / 2);
  }

  public get isGameOver() {
    if (this.player1.hqHp <= 0 || this.player2.hqHp <= 0) return true;
    if (this.maxTurns !== Infinity && this.currentRound > this.maxTurns) return true;
    return false;
  }

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
    
    // 如果没有被特殊规则（如战役）设置过 maxCp，则初始化为 0
    // 这样第一个回合 startTurn 时就会正确变为 1
    if (this.player1.maxCp === undefined || this.player1.maxCp === 0) {
      this.player1.maxCp = 0;
      this.player2.maxCp = 0;
    } else {
      // 战役特殊规则，开局设置了极高上限，减去1，因为 startTurn 马上会 +1
      this.player1.maxCp -= 1;
      this.player2.maxCp -= 1;
    }

    this.addLog(this.player1.name, `游戏开始！你的先手回合。`, 'system');
    this.nextTurn(true);
  }

  public nextTurn(isFirstTurn: boolean = false) {
    this.turnNumber++;
    this.currentPlayer = this.currentPlayer === this.player1 ? this.player2 : this.player1;
    console.log(`\n=== 第 ${this.turnNumber} 回合 : ${this.currentPlayer.name} 的回合 ===`);
    this.addLog(this.currentPlayer.name, `回合开始。`, 'system');
    this.currentPlayer.startTurn(isFirstTurn);

    // 触发环境卡的每回合效果
    if (this.activeEnvironment && this.activeEnvironment.onTurnStart) {
      this.addLog('全局', `环境 [${this.activeEnvironment.name}] 生效。`, 'environment');
      this.activeEnvironment.onTurnStart(this);
    }

    // 触发指挥官的被动（需要game上下文）
    if (this.currentPlayer.commander && this.currentPlayer.commander.onTurnStart) {
      this.addLog(this.currentPlayer.name, `指挥官被动 [${this.currentPlayer.commander.passiveName}] 触发。`, 'skill');
      this.currentPlayer.commander.onTurnStart(this, this.currentPlayer);
    }
  }

  public addLog(playerName: string, message: string, type: 'play' | 'attack' | 'skill' | 'environment' | 'system') {
    this.logs.push({
      id: Math.random().toString(36).substring(7),
      turn: this.turnNumber,
      playerName,
      message,
      type
    });
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
    this.addLog(player.name, `消耗 ${unit.moveCost} CP 将 [${unit.name}] 推进至前线。`, 'play');
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
    this.addLog(attackerOwner.name, `[${attacker.name}] 攻击了 [${defender.name}]。`, 'attack');
    
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
      this.addLog(attackerOwner.name, `[${attacker.name}] 对 [${defender.name}] 造成了 ${damageToHp} 点伤害。`, 'attack');
    }

    attacker.hasAttackedThisTurn = true;

    if (defender.hp > 0 && defender.keywords.includes(Keyword.AMBUSH)) {
      console.log(`-> [伏击] ${defender.name} 触发伏击，对 ${attacker.name} 造成反击！`);
      this.addLog(defenderOwner.name, `[${defender.name}] 触发伏击，反击了 [${attacker.name}]。`, 'attack');
      let counterAtk = defender.attack;
      if (attacker.keywords.includes(Keyword.HEAVY_ARMOR)) {
        counterAtk = Math.max(0, counterAtk - 2);
        console.log(`   -> [重甲] 攻击方免疫了2点反击伤害，实际反击力为 ${counterAtk}`);
      }
      if (counterAtk <= attacker.defense) {
        attacker.defense -= counterAtk;
      } else {
        const damageToHp = counterAtk - attacker.defense;
        attacker.hp -= damageToHp;
        attacker.defense = 0;
        this.addLog(defenderOwner.name, `[${defender.name}] 反击了 [${attacker.name}]，造成了 ${damageToHp} 点伤害。`, 'attack');
      }
    if (attacker.hp <= 0) {
        console.log(`=> 伏击导致 ${attacker.name} 阵亡！`);
        this.addLog('系统', `[${attacker.name}] 阵亡。`, 'system');
        this.destroyUnit(attackerOwner, attacker);
        this.promoteUnit(defender, defenderOwner);
      }
    }

    if (defender.hp <= 0) {
      console.log(`=> ${defender.name} 阵亡！`);
      this.addLog('系统', `[${defender.name}] 阵亡。`, 'system');
      this.destroyUnit(defenderOwner, defender);
      if (attacker.hp > 0) {
          this.promoteUnit(attacker, attackerOwner);
      }
    }
    
    return true;
  }

  // 单位晋升逻辑 (Veterancy)
  private promoteUnit(unit: UnitCard, owner: Player) {
      unit.kills = (unit.kills || 0) + 1;
      const rankThresholds = [2, 5, 9]; // 2杀老兵，5杀精锐，9杀王牌
      const currentRank = unit.rank || 0;
      
      if (currentRank < rankThresholds.length && unit.kills >= rankThresholds[currentRank]) {
          unit.rank = currentRank + 1;
          const rankNames = ['新兵', '老兵', '精锐', '王牌'];
          unit.attack += 1;
          unit.maxHp += 2;
          unit.hp = unit.maxHp; // 晋升时回满血
          this.addLog('系统', `[${unit.name}] 晋升为 ${rankNames[unit.rank]}！攻击力+1，血量+2并恢复满血。`, 'skill');
      }
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
    
    let damage = attacker.attack;
    if (attacker.category === UnitCategory.AIR_FORCE) {
      damage = Math.floor(damage * 1.5);
    }
    
    defenderPlayer.takeHqDamage(damage);
    this.addLog(this.currentPlayer.name, `[${attacker.name}] 攻击了敌方指挥部，造成了 ${damage} 点伤害。`, 'attack');
    
    if (defenderPlayer.hqHp <= 0) {
      console.log(`=> 敌方HQ被摧毁，游戏结束！`);
      this.addLog('系统', `敌方指挥部被摧毁！`, 'system');
    }
    
    // 攻击总部也算作一次击杀（战功）
    this.promoteUnit(attacker, this.currentPlayer);
    
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
      logs: this.logs,
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

  public deserialize(state: any, isHost: boolean = true) {
    this.turnNumber = state.turnNumber;
    this.activeEnvironment = state.activeEnvironment;
    this.logs = state.logs || [];
    
    if (isHost) {
      this.currentPlayer = state.currentPlayer === 'p1' ? this.player1 : this.player2;
      
      this.player1.hqHp = state.p1.hqHp;
      this.player1.cp = state.p1.cp;
      this.player1.maxCp = state.p1.maxCp;
      this.player1.hand = state.p1.hand;
      this.player1.board = state.p1.board;
      this.player1.commander = state.p1.commander;
      
      this.player2.hqHp = state.p2.hqHp;
      this.player2.cp = state.p2.cp;
      this.player2.maxCp = state.p2.maxCp;
      this.player2.hand = state.p2.hand;
      this.player2.board = state.p2.board;
      this.player2.commander = state.p2.commander;
    } else {
      // 客机视角：主机的 p1 是客机的 p2，主机的 p2 是客机的 p1
      this.currentPlayer = state.currentPlayer === 'p1' ? this.player2 : this.player1;
      
      this.player1.hqHp = state.p2.hqHp;
      this.player1.cp = state.p2.cp;
      this.player1.maxCp = state.p2.maxCp;
      this.player1.hand = state.p2.hand;
      this.player1.board = state.p2.board;
      this.player1.commander = state.p2.commander;
      
      this.player2.hqHp = state.p1.hqHp;
      this.player2.cp = state.p1.cp;
      this.player2.maxCp = state.p1.maxCp;
      this.player2.hand = state.p1.hand;
      this.player2.board = state.p1.board;
      this.player2.commander = state.p1.commander;
    }
  }
}
