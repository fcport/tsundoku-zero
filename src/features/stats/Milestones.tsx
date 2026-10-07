// Livello features/stats: i TRAGUARDI (07-10-2026). Per ogni famiglia il massimo
// raggiunto e le quattro soglie, ciascuna col suo timbro: rosso se presa (con la
// data), spento se ancora da prendere. Una volta presi, restano (`milestones`).
import type { MilestoneTrack } from '../../domain/milestones';
import { resolveLocale, useTranslation } from '../../i18n';
import { Stamp } from '../../ui/Stamp';
import { MILESTONE_STAMPS } from '../lessons/stamps';

export interface MilestonesProps {
  readonly tracks: readonly MilestoneTrack[];
  /** Il fuso in cui leggere il giorno di ogni traguardo. */
  readonly timeZone: string;
  /** Il titolo di sezione (`<h3>`), con le classi della schermata. */
  readonly headingClassName: string;
}

export function Milestones({ tracks, timeZone, headingClassName }: MilestonesProps) {
  const { t, i18n } = useTranslation();
  const locale = resolveLocale(i18n.language);
  const date = new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone,
  });

  return (
    <>
      <h3 className={headingClassName}>{t('stats.milestones.heading')}</h3>
      <p className="-mt-4 text-body text-ink-secondary">{t('stats.milestones.hint')}</p>
      {tracks.map((track) => {
        const family = t(`stats.milestones.family.${track.family}`);
        return (
          <section key={track.family} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h4 className="text-[18px] font-bold text-ink-primary">{family}</h4>
              <p className="text-label text-ink-secondary">
                {t('stats.milestones.progress', { best: track.best })}
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-5">
              {track.milestones.map((milestone) => {
                const achieved = milestone.achievedAt !== null;
                return (
                  <li key={milestone.threshold} className="flex items-center gap-3">
                    <Stamp
                      segments={MILESTONE_STAMPS[track.family]}
                      size="sm"
                      faded={!achieved}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="sr-only">
                        {t('stats.milestones.entry', { family, threshold: milestone.threshold })}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`text-[28px] font-extrabold leading-none font-stretch-condensed ${
                          achieved ? 'text-ink-primary' : 'text-ink-muted'
                        }`}
                      >
                        {milestone.threshold}
                      </span>
                      {milestone.achievedAt !== null ? (
                        <span className="whitespace-nowrap text-label-caps text-ink-secondary">
                          {t('stats.milestones.achievedOn', {
                            date: date.format(milestone.achievedAt),
                          })}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
