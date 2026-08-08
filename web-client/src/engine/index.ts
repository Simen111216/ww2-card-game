import { Faction, CardType, UnitCard, OrderCard, Keyword } from './types';
import { Player } from './Player';
import { Game } from './Game';

// 辅助函数：创建单位卡
function createUnit(id: string, name: string, faction: Faction, deployCost: number, attack: number, defense: number, hp: number, moveCost: number): UnitCard {
  return {
    id,
    name,
    description: `一个强大的${faction}单位`,
    type: CardType.UNIT,
    faction,
    deployCost,
    attack,
    defense,
    hp,
    maxHp: hp,
    moveCost,
    keywords: [],
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false
  };
}

// 辅助函数：创建指令卡
function createOrder(id: string, name: string, faction: Faction, deployCost: number): OrderCard {
  return {
    id,
    name,
    description: `特殊的${faction}战术指令`,
    type: CardType.ORDER,
    faction,
    deployCost,
    effect: (game: any, target?: any) => {
      console.log(`执行指令：${name} 的效果！`);
    }
  };
}

// 构建卡组
function buildDeck(faction: Faction): any[] {
  const deck: any[] = [];
  for (let i = 1; i <= 15; i++) {
    if (i % 3 === 0) {
      deck.push(createOrder(`${faction}-order-${i}`, `战术指令 ${i}`, faction, 2));
    } else {
      // 攻击1-15, 防御1-15, 血量1-20
      deck.push(createUnit(
        `${faction}-unit-${i}`, 
        `${faction}步兵团 ${i}`, 
        faction, 
        3, // 部署花费
        Math.floor(Math.random() * 10) + 2, // 攻击
        Math.floor(Math.random() * 5) + 1,  // 防御
        Math.floor(Math.random() * 10) + 5, // 血量
        1  // 移动花费
      ));
    }
  }
  return deck;
}

// 初始化玩家
const p1Deck = buildDeck(Faction.SOVIET);
const p2Deck = buildDeck(Faction.GERMANY);

const p1 = new Player("苏联指挥官", Faction.SOVIET, p1Deck);
const p2 = new Player("德国指挥官", Faction.GERMANY, p2Deck);

const game = new Game(p1, p2);
game.startGame();

// 模拟第一回合 (P2先动，因为在startGame中调用了nextTurn将currentPlayer切给了P2, 这里稍作修正，nextTurn第一次应该切给P1。我们看看Game.ts逻辑)
// game初始化时 currentPlayer 是 p1。
// nextTurn会把 currentPlayer 切换。 所以为了让P1先手，初始化时可以设置为 p2，或者修改逻辑。
// 当前代码初始化是p1，startGame直接调 nextTurn，导致第一回合变成了P2。
// 我们在脚本中手动再切换一下，或者直接接受当前演示。
// 为了清晰，我们假设当前是 P2的回合（根据Game.ts里的逻辑）。

// 我们来强制多过几个回合积累CP
game.nextTurn(); // 回合2 (P1)
game.nextTurn(); // 回合3 (P2)
game.nextTurn(); // 回合4 (P1) 当前CP应该是4

console.log("\n--- P1 尝试打出卡牌 ---");
// 打印手牌
console.log(`P1手牌数: ${p1.hand.length}`);
// 强行把手牌中的单位部署
p1.cp = 20;
for (let i = p1.hand.length - 1; i >= 0; i--) {
  if (p1.hand[i].type === CardType.UNIT) {
    p1.playCard(i);
  }
}

game.nextTurn(); // 回合5 (P2)
p2.cp = 20;
for (let i = p2.hand.length - 1; i >= 0; i--) {
  if (p2.hand[i].type === CardType.UNIT) {
    p2.playCard(i);
  }
}

game.nextTurn(); // 回合6 (P1) CP:6
console.log("\n--- 战斗演示 ---");
// 给场上单位添加一些测试数据，保证能看到战斗效果
if (p1.board.length > 0 && p2.board.length > 0) {
  const p1Unit = p1.board[0]!;
  const p2Unit = p2.board[0]!;
  
  // P1 攻击 P2单位
  game.attackUnit(p1Unit, p2Unit, p1, p2);

  // 假设 P1单位 还可以攻击总部 (修改状态为了演示)
  p1Unit.hasAttackedThisTurn = false;
  game.attackHQ(p1Unit, p2);
}

console.log("\n--- 游戏状态 ---");
console.log(`P1 总部血量: ${p1.hqHp}`);
console.log(`P2 总部血量: ${p2.hqHp}`);
