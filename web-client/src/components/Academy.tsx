import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ADVANCED_CARDS_DATA, ADVANCED_ORDERS_DATA } from '../App';
import { CardComponent } from './CardComponent';

const LESSONS = [
  {
    id: 1,
    title: '装甲战术：闪电战与大纵深',
    content: `在二战初期，德国凭借“闪电战”战术横扫欧洲。其核心在于将装甲部队（坦克）、摩托化步兵和空中支援（如斯图卡轰炸机）紧密结合，进行快速突破和纵深包围。而在东线，苏联通过血的教训发展出了“大纵深作战理论”，强调在广阔的战线上进行多梯队、连续的猛烈突击，利用庞大的人力物力和 T-34 坦克的机动性粉碎敌军防线。`,
    questions: [
      { q: '德国“闪电战”的核心战术特点是什么？', options: ['阵地战与消耗战', '装甲、步兵与空军的快速协同突破', '单纯依靠海军封锁', '游击战与破坏补给线'], answer: 1 },
      { q: '苏联对抗并反击德军的重要战术理论是什么？', options: ['大纵深作战理论', '马奇诺防线', '跳岛战术', '无限制潜艇战'], answer: 0 }
    ]
  },
  {
    id: 2,
    title: '空降与特种作战',
    content: `二战见证了空降兵和特种部队的崛起。美国的 101 空降师在诺曼底登陆中深入敌后，扰乱了德军的部署。英国的 SAS（特种空勤团）则在北非沙漠和欧洲敌后执行了无数次惊心动魄的破坏任务，他们的座右铭是“勇者必胜”。在游戏中，这些部队往往带有【伏击】或【闪击】等能够出其不意打击敌人的词条。`,
    questions: [
      { q: '英国 SAS 的座右铭是什么？', options: ['绝不后退一步', '勇者必胜', '永远忠诚', '闪电出击'], answer: 1 },
      { q: '美国 101 空降师在诺曼底战役中的主要任务是？', options: ['在海滩正面强攻', '在敌后空降扰乱德军部署', '在空中与德国空军狗斗', '负责后勤运输'], answer: 1 }
    ]
  },
  {
    id: 3,
    title: '终极武器与战略轰炸',
    content: `战争后期，交战双方都在研发终极武器以打破僵局。德国研发了 V2 火箭，这是世界上第一种弹道导弹，能够跨越英吉利海峡直接打击伦敦。而美国则推进了“曼哈顿计划”，最终研制出原子弹，从根本上改变了战争的形态和战后的世界格局。战略轰炸（如 B-17 地毯式轰炸）也成为了摧毁敌国工业和意志的重要手段。`,
    questions: [
      { q: '世界上第一种弹道导弹是？', options: ['喀秋莎火箭炮', 'V2 火箭', '巡航导弹', '防空导弹'], answer: 1 },
      { q: '美国研制原子弹的计划代号是？', options: ['霸王行动', '巴巴罗萨计划', '曼哈顿计划', '火炬行动'], answer: 2 }
    ]
  }
];

export function Academy({ onClose }: { onClose: () => void }) {
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [phase, setPhase] = useState<'reading' | 'quiz' | 'result'>('reading');
  const [answers, setAnswers] = useState<number[]>([]);
  const [rewardCard, setRewardCard] = useState<any>(null);

  const lesson = LESSONS[currentLessonIndex];

  const handleStartQuiz = () => {
    setPhase('quiz');
    setAnswers(new Array(lesson.questions.length).fill(-1));
  };

  const handleSelectAnswer = (qIndex: number, optionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[qIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    let score = 0;
    answers.forEach((ans, i) => {
      if (ans === lesson.questions[i].answer) score++;
    });

    if (score === lesson.questions.length) {
      // 优秀，发放奖励
      grantReward();
    } else {
      setRewardCard(null);
    }
    setPhase('result');
  };

  const grantReward = () => {
    const allAdv = [...ADVANCED_CARDS_DATA, ...ADVANCED_ORDERS_DATA];
    let unlockedIds: string[] = [];
    try {
      unlockedIds = JSON.parse(localStorage.getItem('unlockedCards') || '[]');
    } catch(e) {}

    // 过滤掉已解锁的
    const lockedCards = allAdv.filter(c => !unlockedIds.includes(c.id));
    if (lockedCards.length > 0) {
      const reward = lockedCards[Math.floor(Math.random() * lockedCards.length)];
      unlockedIds.push(reward.id);
      localStorage.setItem('unlockedCards', JSON.stringify(unlockedIds));
      
      // 格式化一下以便展示
      const cardObj = {
        id: reward.id,
        name: reward.name,
        description: reward.desc,
        type: reward.type,
        faction: reward.faction,
        deployCost: reward.cost,
        attack: (reward as any).atk,
        defense: (reward as any).def,
        hp: (reward as any).hp,
        maxHp: (reward as any).hp,
        isAdvanced: true,
        keywords: (reward as any).keywords || []
      };
      setRewardCard(cardObj);
    } else {
      setRewardCard('ALL_UNLOCKED');
    }
  };

  const handleNextLesson = () => {
    if (currentLessonIndex < LESSONS.length - 1) {
      setCurrentLessonIndex(i => i + 1);
      setPhase('reading');
    } else {
      onClose();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-8"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }}
        className="bg-gray-800 border-4 border-amber-600 rounded-xl p-8 max-w-4xl w-full max-h-full overflow-y-auto relative shadow-[0_0_50px_rgba(217,119,6,0.3)]"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-3xl">&times;</button>
        
        <div className="flex items-center gap-4 mb-6 border-b border-gray-600 pb-4">
          <span className="text-4xl">🏛️</span>
          <div>
            <h2 className="text-3xl font-black text-amber-500 tracking-widest">高级军事学院</h2>
            <p className="text-gray-400">学习历史战术，通过考核解锁高级卡牌</p>
          </div>
        </div>

        {phase === 'reading' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-gray-900 p-3 rounded">
              <span className="text-gray-400 font-bold">课程 {currentLessonIndex + 1} / {LESSONS.length}</span>
              <span className="text-amber-400 font-bold text-xl">{lesson.title}</span>
            </div>
            <div className="text-gray-300 text-lg leading-relaxed bg-black/40 p-6 rounded border border-gray-700">
              {lesson.content}
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={handleStartQuiz} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg text-lg transition-transform hover:-translate-y-1">
                开始考核 ✍️
              </button>
            </div>
          </div>
        )}

        {phase === 'quiz' && (
          <div className="space-y-8">
            <h3 className="text-2xl font-bold text-center text-white mb-6">考核：{lesson.title}</h3>
            {lesson.questions.map((q, qIndex) => (
              <div key={qIndex} className="bg-gray-900 p-6 rounded-lg border border-gray-700">
                <p className="text-lg font-bold text-blue-400 mb-4">{qIndex + 1}. {q.q}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.options.map((opt, optIndex) => (
                    <button 
                      key={optIndex}
                      onClick={() => handleSelectAnswer(qIndex, optIndex)}
                      className={`p-3 rounded text-left transition-colors border ${answers[qIndex] === optIndex ? 'bg-blue-600 border-blue-400 text-white font-bold' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="flex justify-end pt-4">
              <button 
                onClick={handleSubmit} 
                disabled={answers.includes(-1)}
                className={`font-bold py-3 px-8 rounded-lg text-lg transition-all ${answers.includes(-1) ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white hover:-translate-y-1'}`}
              >
                提交试卷
              </button>
            </div>
          </div>
        )}

        {phase === 'result' && (
          <div className="flex flex-col items-center space-y-6 py-8">
            {rewardCard ? (
              <>
                <h3 className="text-4xl font-black text-green-500 mb-2">考核优秀！</h3>
                <p className="text-gray-300 text-lg">你展现了卓越的指挥官潜质。</p>
                
                {rewardCard === 'ALL_UNLOCKED' ? (
                  <div className="bg-yellow-900/50 border border-yellow-500 text-yellow-300 p-6 rounded-lg text-center mt-4">
                    <p className="text-xl font-bold mb-2">🎓 荣誉毕业生</p>
                    <p>你已经解锁了所有的高级卡牌！去战场上大显身手吧。</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center mt-6">
                    <p className="text-amber-400 font-bold mb-4 animate-pulse">🎉 解锁了新的高级卡牌！</p>
                    <div className="scale-125 origin-top mb-8">
                      <CardComponent card={rewardCard} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-4xl font-black text-red-500 mb-2">考核未通过</h3>
                <p className="text-gray-300 text-lg">历史的教训需要铭记，请重新学习。</p>
                <button onClick={() => setPhase('reading')} className="mt-6 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded">
                  重新学习
                </button>
              </>
            )}

            {rewardCard && (
              <button onClick={handleNextLesson} className="mt-8 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-12 rounded-lg text-lg transition-transform hover:-translate-y-1">
                {currentLessonIndex < LESSONS.length - 1 ? '下一课' : '完成学习并返回大厅'}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}