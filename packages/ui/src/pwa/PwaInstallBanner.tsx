import { usePwaInstall } from "./usePwaInstall";

type PwaInstallBannerProps = {
  appName: string;
  storageKey?: string;
  iconSrc?: string;
  /** Не предлагать установку (например, пока не завершён вход по приглашению) */
  blockedReason?: string;
};

export function PwaInstallBanner({
  appName,
  storageKey,
  iconSrc = "/icon.svg",
  blockedReason,
}: PwaInstallBannerProps) {
  const key = storageKey ?? `pwa-install-${appName.toLowerCase()}`;
  const { visible, mode, install, dismiss } = usePwaInstall(key, Boolean(blockedReason));

  if (blockedReason) {
    return (
      <div className="pwa-install" role="region" aria-label="Установка приложения">
        <div className="pwa-install__card">
          <div className="pwa-install__head">
            <img className="pwa-install__icon" src={iconSrc} alt="" width={44} height={44} />
            <div>
              <p className="pwa-install__title">Сначала войди или зарегистрируйся</p>
              <p className="pwa-install__text">{blockedReason}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!visible || !mode) return null;

  const isAndroid = mode === "android";

  return (
    <div className="pwa-install" role="region" aria-label="Установка приложения">
      <div className="pwa-install__card">
        <div className="pwa-install__head">
          <img className="pwa-install__icon" src={iconSrc} alt="" width={44} height={44} />
          <div>
            <p className="pwa-install__title">
              {isAndroid ? `Установить «${appName}»` : `Добавить «${appName}» на экран`}
            </p>
            <p className="pwa-install__text">
              {isAndroid
                ? "Быстрый доступ с домашнего экрана — как обычное приложение, без адресной строки."
                : "Нажми «Поделиться» в Safari, затем «На экран Домой» — откроется в полноэкранном режиме."}
            </p>
          </div>
        </div>
        <div className="pwa-install__actions">
          {isAndroid ? (
            <button type="button" className="pwa-install__btn pwa-install__btn--primary" onClick={() => void install()}>
              Установить
            </button>
          ) : null}
          <button type="button" className="pwa-install__btn pwa-install__btn--ghost" onClick={dismiss}>
            {isAndroid ? "Позже" : "Понятно"}
          </button>
        </div>
      </div>
    </div>
  );
}
