// Where the asking price stands among similar cars, and which cars those are.

import { isSahibindenUrl } from '../../read/readTab';
import { CONDITIONS, type LeftOut, type Market } from '../../scoring/market';
import type { SectionResult } from '../../scoring/types';
import {
  conditionLabels,
  fieldLabels,
  formatMoney,
  formatNumber,
  leftOutText,
  marketText,
  rememberedText,
  strings,
} from '../strings';

export function MarketCard({ market, price }: { market: Market; price: SectionResult }) {
  // Without a price of its own there is nothing to place.
  if (price.reasons.length === 0) return null;
  return (
    <section className="card market">
      <h3>{strings.marketTitle}</h3>
      {price.reasons.map((reason) =>
        reason.code === 'priceBand' || reason.code === 'noReference' ? (
          <p key={reason.code} className="market-answer">
            {marketText(reason, market.own)}
          </p>
        ) : null,
      )}
      <table>
        <tbody>
          {CONDITIONS.map((condition) => {
            const { count, median } = market.groups[condition];
            return (
              <tr key={condition} className={market.own === condition ? 'own' : undefined}>
                <th scope="row">
                  {conditionLabels[condition]}
                  {market.own === condition && <small> {strings.thisCar}</small>}
                </th>
                <td>{count} araç</td>
                <td>{median === null ? '—' : formatMoney(median)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {market.unread.length > 0 && (
        <p className="quiet">
          {strings.marketUnread} {market.unread.map((field) => fieldLabels[field]).join(', ')}
        </p>
      )}
      {market.remembered === 0 ? (
        <p className="quiet">{strings.marketEmpty}</p>
      ) : (
        <div className="remembered">
          <p>{rememberedText(market.remembered, market.peers.length)}</p>
          <ul>
            {Object.entries(market.leftOut).map(([why, count]) => (
              <li key={why}>
                {count} {leftOutText[why as LeftOut]}
              </li>
            ))}
          </ul>
        </div>
      )}
      {market.peers.length > 0 ? (
        <details>
          <summary>
            {strings.peers} ({market.peers.length})
          </summary>
          <ul className="peers">
            {market.peers.map((peer) => (
              <li key={peer.id}>
                <strong>{formatMoney(peer.price!)}</strong>
                <span>
                  {peer.year}, {formatNumber(peer.km!, 0)} km, {conditionLabels[peer.condition]}
                </span>
                {isSahibindenUrl(peer.url) && (
                  <a href={peer.url} target="_blank" rel="noreferrer">
                    {peer.title ?? strings.openListing}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
