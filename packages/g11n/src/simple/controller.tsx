import { FC, useMemo, useState } from "react";
import { IntlConfig, IntlShape, RawIntlProvider, createIntl, createIntlCache } from 'react-intl';
import { G11nProvider } from "../common/context";


/**
 * Properties expected by the {@link SimpleController} component.
 *
 * Note that properties from the {@link IntlConfig} are only used in their
 * initial configuration, serving as initial parameters. Changing them after
 * the component has been mounted will have no effect.
 */
export interface SimpleControllerProps extends Omit<
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


/**
 * A controller that receives the initial current locale and the set of
 * supported locales along with all their messages.
 */
export const SimpleController: FC<SimpleControllerProps> = ({
    initialLocale = 'browser',
    messages,
    children,
    ...rest
}) => {
    // Save the current locale in the state.
    const [locale, setLocale] = useState<string>(() => {
        if (initialLocale === 'browser') {
            return navigator.language;
        } else {
            return initialLocale;
        }
    });

    // The value for react-intl context.
    const value: IntlShape = useMemo(() => (
        createIntl({
            locale,
            messages: messages[locale],
            ...rest,
        }, createIntlCache())
    ), [locale, messages]);

    return (
        <G11nProvider value={{
            locale,
            setLocale,
        }}>
            <RawIntlProvider value={value}>
                {children}
            </RawIntlProvider>
        </G11nProvider>
    );
}
