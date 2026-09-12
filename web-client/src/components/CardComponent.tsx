import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardType, Faction } from '../engine/types';
import type { BaseCard, UnitCard } from '../engine/types';

interface CardProps {
  card: BaseCard;
  onClick?: () => void;
  isSelected?: boolean;
  canPlay?: boolean;
}

const factionColors: Record<Faction, string> = {
  [Faction.SOVIET]: 'bg-red-800 border-red-900',
  [Faction.USA]: 'bg-blue-700 border-blue-900',
  [Faction.UK]: 'bg-green-800 border-green-900',
  [Faction.FRANCE]: 'bg-blue-400 border-blue-600',
  [Faction.GERMANY]: 'bg-gray-700 border-gray-900',
};

const keywordDescriptions: Record<string, string> = {
  '闪击': '部署当回合即可攻击',
  '守护': '敌方必须先攻击此单位',
  '伏击': '受击前先造成反击伤害',
  '重甲': '受到的所有伤害 -1',
  '防空': '对空军造成额外伤害'
};

export const CardComponent: React.FC<CardProps> = ({ card, onClick, isSelected, canPlay = true }) => {
  const { t } = useTranslation();
  const isUnit = card.type === CardType.UNIT;
  const unitCard = isUnit ? (card as UnitCard) : null;
  const bgColor = factionColors[card.faction] || 'bg-gray-600';

  return (
    <div
      id={`card-${card.id}`}
      onClick={canPlay ? onClick : undefined}
      className={`
        relative w-40 h-64 rounded-lg shadow-lg overflow-hidden border-4 transition-transform duration-200
        ${bgColor}
        ${canPlay ? 'cursor-pointer hover:-translate-y-4 hover:shadow-xl' : 'opacity-75 cursor-not-allowed'}
        ${isSelected ? 'ring-4 ring-yellow-400 -translate-y-4' : 'border-gray-800'}
        flex flex-col text-white select-none
      `}
    >
      {/* 部署消耗 - 左上角 */}
      <div className="absolute top-1 left-1 bg-yellow-500 text-black font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-yellow-700 z-10 shadow-sm">
        {card.deployCost}
      </div>

      {/* 卡牌类型标识 - 右上角 */}
      <div className="absolute top-2 right-2 text-xs font-bold uppercase opacity-80 z-10 flex gap-1">
        {card.isAdvanced && (
           <span className="bg-amber-600 text-white px-1 rounded shadow-lg border border-amber-400">{t('card.advanced')}</span>
        )}
        <span className="bg-black/50 px-1 rounded">
          {card.type === CardType.UNIT ? (unitCard?.category ? t(`card.category.${unitCard.category}`) : t('card.unit')) : t('card.order')}
        </span>
      </div>

      {/* 图片/插图占位 */}
      <div className="w-full h-24 bg-gray-900/50 mt-4 border-b-2 border-t-2 border-gray-800 flex items-center justify-center">
        <span className="text-gray-400 text-sm italic">{t('card.imagePlaceholder')}</span>
      </div>

      {/* 卡牌名称 */}
      <div className="px-2 py-1 bg-black/60 text-center font-bold text-sm border-b-2 border-gray-800">
        {card.name}
      </div>
      
      {/* 军衔展示区 (仅单位卡且在场上时可能有 rank) */}
      {unitCard && (unitCard.rank || 0) > 0 && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex gap-0.5 z-10 drop-shadow-md">
          {Array.from({ length: unitCard.rank! }).map((_, i) => (
             <span key={i} className="text-yellow-400 text-lg leading-none">★</span>
          ))}
        </div>
      )}

      {/* 卡牌描述 / 词条解析 */}
      <div className="p-2 text-[9px] flex-grow bg-white/10 text-gray-200 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-track]:bg-transparent flex flex-col justify-start gap-1 leading-tight">
        {isUnit ? (
          <>
            {/* 专属词条（如果有） */}
            {unitCard.exclusiveName && (
              <div className="border-b border-gray-600/50 pb-1 mb-1">
                <span className="font-bold text-yellow-400">◆ {unitCard.exclusiveName}</span>
                <p className="text-gray-300 mt-0.5">{unitCard.exclusiveDesc}</p>
              </div>
            )}
            
            {/* 基础词条 */}
            {unitCard.keywords.length > 0 ? (
              <div className="flex flex-col gap-1 text-left w-full">
                {unitCard.keywords.map((kw, i) => (
                  <div key={i} className="flex">
                    <span className="font-bold text-purple-300 shrink-0">【{t(`card.keywords.${kw}`)}】</span>
                    <span className="text-gray-400 ml-0.5">{t(`card.keywordDesc.${kw}`)}</span>
                  </div>
                ))}
              </div>
            ) : (
              !unitCard.exclusiveName && <span className="text-gray-500 italic text-center w-full">{t('card.noSpecialTrait')}</span>
            )}
          </>
        ) : (
          <span className="text-center w-full">{card.description}</span>
        )}
      </div>

      {/* 属性栏 (仅单位卡显示) */}
      {unitCard && (
        <div className="w-full h-6 shrink-0 bg-black/80 flex justify-between items-center px-2 text-[11px] font-bold border-t-2 border-gray-800">
          <div className="text-red-400 flex items-center" title={t('card.attack')}>
            ⚔ {unitCard.attack}
          </div>
          <div className="text-blue-400 flex items-center" title={t('card.defense')}>
            🛡 {unitCard.defense}
          </div>
          <div className="text-green-400 flex items-center" title={t('card.hp')}>
            ❤ {unitCard.hp}
          </div>
        </div>
      )}
    </div>
  );
};
