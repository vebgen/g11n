import {
    IntlConfig, IntlShape, RawIntlProvider, createIntl, createIntlCache
} from 'react-intl';

export interface CoProps extends Omit<
    IntlConfig, "messages" | "locale"
> {
    /**
     * The initial locale.
     *
     * By default it queries the browser for the current locale.
     * After the component has been mounted, the locale can be changed
     * by using the {@link G11nContext}.
     */
    initialLocale?: string;

    /**
     * The messages for all supported locales.
     *
     * First key is the locale, second key is the message key.
     */
    messages: Record<string, Record<string, string>>;

    /**
     * The children to render.
     */
    children: React.ReactNode;
}
