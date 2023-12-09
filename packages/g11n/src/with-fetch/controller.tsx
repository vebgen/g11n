import { FC, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { IntlConfig, IntlShape, RawIntlProvider, createIntl, createIntlCache } from 'react-intl';
import { G11nProvider } from "../common/context";


/**
 * Properties expected by the {@link FetchController} component.
 *
 * Note that properties from the {@link IntlConfig} are only used in their
 * initial configuration, serving as initial parameters. Changing them after
 * the component has been mounted will have no effect.
 */
export interface FetchControllerProps extends Omit<
    IntlConfig, "messages" | "locale"
> {
    /**
     * The initial locale.
     *
     * By default it queries the browser for the current locale.
     * After the component has been mounted, the locale can be changed
     * by using the {@link G11nContext}.
     *
     * Note that, if the `initialLocale` is not found in the `messages`
     * property, then the component will not render anything until the
     * messages were loaded.
     */
    initialLocale?: string;

    /**
     * Preloaded locales.
     *
     * First key is the locale, second key is the message key.
     */
    messages: Record<string, Record<string, string>>;

    /**
     * The remote location from where to fetch the messages.
     *
     * This can be either a string, in which case `/`, the locale key and
     * `.json` are appended to it, or a function takes as argument the locale
     * and that returns a string.
     */
    localeUrl: string | ((locale: string) => string);

    /**
     * The options to pass to the fetch request.
     */
    fetchOptions?: RequestInit;

    /**
     * The children to render.
     */
    children: React.ReactNode;
}


/**
 * The error codes that can be set in the state.
 */
export type ErrorCodes = "network-error" | "not-found" | "invalid";


/**
 * The state of the {@link FetchController} component.
 */
export interface FetchState {
    /**
     * The current locale.
     *
     * This is only set to a value after we have corresponding messages
     * in the list.
     */
    locale?: string;

    /**
     * The messages for all loaded locales are saved here.
     *
     * First key is the locale, second key is the message key.
     */
    messages: Record<string, Record<string, string>>;

    /**
     * The locale that was requested by the user.
     *
     * This is only set while a request is in progress.
     */
    requestedLocale?: string;

    /**
     * The error that occurred while fetching the locale.
     */
    error?: {
        /**
         * The error code.
         */
        code: ErrorCodes;

        /**
         * The error message, if any.
         */
        message?: string;

        /**
         * The locale that was requested.
         */
        locale: string;
    };
};


/**
 * The action changes the current locale. It also clears the error state.
 */
export interface SetLocaleAction {
    type: 'setLocale';

    /**
     * The new locale.
     */
    locale: string;
};


/**
 * The action sets the error state. The locale will be set from the
 * `requestedLocale` state member.
 */
export interface SetErrorAction {
    type: 'setError';

    /**
     * The error code.
     */
    code: ErrorCodes;

    /**
     * The error message, if any.
     */
    message?: string;
};


/**
 * The action sets the messages for a locale and changes the current locale.
 * The locale will be set from the `requestedLocale` state member.
 */
export interface SetMessagesAction {
    type: 'setMessages';

    /**
     * The messages for the locale.
     */
    messages: Record<string, string>;
};


/**
 * The actions that can be dispatched to the reducer.
 */
export type FetchAction =
    | SetMessagesAction
    | SetLocaleAction
    | SetErrorAction;


/**
 * A controller that can retrieve messages from a server.
 */
export const FetchController: FC<FetchControllerProps> = ({
    initialLocale = 'browser',
    messages,
    localeUrl,
    fetchOptions = {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    },
    children,
    ...rest
}) => {
    // Abort controller for the fetch request.
    const abortController = useRef<AbortController | undefined>();

    // The state of the controller.
    const [state, dispatch] = useReducer((
        state: FetchState, action: FetchAction
    ) => {
        switch (action.type) {

            case 'setLocale':
                return {
                    ...state,
                    locale: action.locale,
                    error: undefined,
                };

            case 'setError':
                return {
                    ...state,
                    error: {
                        code: action.code,
                        message: action.message,
                        locale: state.requestedLocale!,
                    },
                };

            case 'setMessages':
                return {
                    ...state,
                    locale: state.requestedLocale!,
                    error: undefined,
                    messages: {
                        ...state.messages,
                        [state.requestedLocale!]: action.messages,
                    },
                    requestedLocale: undefined,
                };

            default:
                return state;
        }
    }, {
        locale: undefined,
        requestedLocale: undefined,
        error: undefined,
        messages: { ...messages }
    } as FetchState);


    // The callback used by the user to change the locale.
    const setLocale = useCallback((locale: string) => {
        // If a fetch request is in progress, then abort it.
        if (abortController.current) {
            abortController.current.abort();
            abortController.current = undefined;
        }

        // If the locale does exist in the messages, then change it.
        if (messages[locale]) {
            dispatch({
                type: 'setLocale',
                locale,
            });
        }

        // We need to request this locale.
        const url = typeof localeUrl === 'function'
            ? localeUrl(locale)
            : `${localeUrl}/${locale}.json`;
        fetch(
            url, fetchOptions
        ).then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                dispatch({
                    type: 'setError',
                    code: 'not-found',
                    message: response.statusText,
                });
            }
        }).then((messages) => {
            if (messages) {
                dispatch({ type: 'setMessages', messages, });
            } else {
                dispatch({ type: 'setError', code: 'invalid', });
            }
        }).catch((error) => {
            if (error.name !== 'AbortError') {
                console.error("[FetchController] fetch error: %O", error);

                // This only happens when a network error is encountered.
                dispatch({
                    type: 'setError',
                    code: 'network-error',
                    message: error.statusText || error.message,
                });
            }
        });
    }, [messages, fetchOptions, localeUrl]);


    // Executed at mount time.
    useEffect(() => {
        // Load initial locale.
        if (initialLocale === 'browser') {
            setLocale(navigator.language);
        } else {
            setLocale(initialLocale);
        }

        // Executed at unmount time.
        return () => {
            // If a fetch request is in progress, then abort it.
            if (abortController.current) {
                abortController.current.abort();
                abortController.current = undefined;
            }
        }
    }, []);


    // The value for react-intl context.
    const value: IntlShape | undefined = useMemo(() => (
        state.locale
            ? createIntl({
                locale: state.locale,
                messages: messages[state.locale],
                ...rest,
            }, createIntlCache())
            : undefined
    ), [state.locale, messages]);

    // Only render the children if there is a locale.
    if (!state.locale || !value) {
        return null;
    }

    return (
        <G11nProvider value={{
            locale: state.locale,
            setLocale,
        }}>
            <RawIntlProvider value={value}>
                {children}
            </RawIntlProvider>
        </G11nProvider>
    );
}
