import { isSahibindenUrl } from '../../read/readTab';
import { CarDiagram } from '../CarDiagram';
import { ScoreRing } from '../ScoreRing';
import { sectionLabels, strings, verdictText } from '../strings';
import { useListings } from '../useListings';
import { buildComparison } from './rows';
import { parseIds } from './url';

export function CompareApp() {
  const { listings, loaded, error } = useListings();
  const { columns, rows, missing } = buildComparison(
    parseIds(location.search),
    listings,
    new Date(),
  );
  const best = (index: number) => (columns[index]?.isBest ? 'best' : undefined);

  return (
    <main>
      <h1>{strings.compare}</h1>
      {error && (
        <p className="banner error" role="alert">
          {error}
        </p>
      )}
      {loaded && missing.length > 0 && (
        <p className="banner" role="status">
          {strings.notFound} {missing.map((id) => `#${id}`).join(', ')}
        </p>
      )}
      {columns.length === 0 ? (
        <p className="empty">{strings.compareNothing}</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th />
                {columns.map((column, index) => (
                  <th key={column.id} scope="col" className={best(index)}>
                    <ScoreRing score={column.total} level={column.level} />
                    <span className="verdict-name">{verdictText[column.level].title}</span>
                    <span className="title">{column.title}</span>
                    <span className="meta">
                      #{column.id}
                      {isSahibindenUrl(column.url) && (
                        <>
                          {' · '}
                          <a href={column.url} target="_blank" rel="noreferrer">
                            {strings.openListing}
                          </a>
                        </>
                      )}
                    </span>
                    {column.excluded.length > 0 && (
                      <span className="excluded">
                        {strings.leftOut}{' '}
                        {column.excluded.map((key) => sectionLabels[key]).join(', ')}
                      </span>
                    )}
                    <CarDiagram parts={column.parts} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td key={columns[index]!.id} className={row.best[index] ? 'best' : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">{strings.askingPrice}</p>
    </main>
  );
}
