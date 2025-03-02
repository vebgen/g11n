import { FC, useMemo, useState } from "react";
import {
    IntlConfig, IntlShape, RawIntlProvider, createIntl, createIntlCache
} from 'react-intl';

import { G11nProvider } from "../common/context";
import { CoProps } from "../common";


/**
 * Properties expected by the {@link SimpleController} component.
 *
 * Note that properties from the {@link IntlConfig} are only used in their
 * initial configuration, serving as initial parameters. Changing them after
 * the component has been mounted will have no effect.
 */
export interface SimpleControllerProps extends CoProps {}


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
    ), [locale, messages]); // eslint-disable-line react-hooks/exhaustive-deps

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
