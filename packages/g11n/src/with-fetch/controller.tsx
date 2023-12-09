import {
    FC, useCallback, useEffect, useMemo, useReducer, useRef
} from "react";
import {
    IntlConfig, IntlShape, RawIntlProvider, createIntl, createIntlCache
} from 'react-intl';

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
 * A request for this locale is about to be sent.
 */
export interface SetRequestedLocaleAction {
    type: 'setRequestedLocale';

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
    | SetRequestedLocaleAction
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
    // console.log("[FetchController] render initialLocale=%O", initialLocale);
    // console.log("[FetchController] render messages=%O", messages);
    // console.log("[FetchController] render localeUrl=%O", localeUrl);
    // console.log("[FetchController] render fetchOptions=%O", fetchOptions);
    // console.log("[FetchController] render rest=%O", rest);

    // Abort controller for the fetch request.
    const abortController = useRef<AbortController | undefined>();

    // The state of the controller.
    const [state, dispatch] = useReducer((
        state: FetchState, action: FetchAction
    ) => {
        // console.log("[FetchController] dispatch action=%O", action);
        switch (action.type) {

            case 'setLocale':
                return {
                    ...state,
                    locale: action.locale,
                    error: undefined,
                };

            case 'setRequestedLocale':
                return {
                    ...state,
                    requestedLocale: action.locale,
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
    // console.log("[FetchController] current state %O", state);

    // The callback used by the user to change the locale.
    const setLocale = useCallback((locale: string) => {
        // console.log("[FetchController] setLocale=%O", locale);

        if (state.locale === locale) {
            // console.log("[FetchController] locale is already set");
            return;
        }

        // If a fetch request is in progress, then abort it.
        if (abortController.current) {
            abortController.current.abort();
            abortController.current = undefined;
            // console.log("[FetchController] previous request aborted");
        }

        // If the locale does exist in the messages, then change it.
        if (Object.prototype.hasOwnProperty.call(state.messages, locale)) {
            // console.log("[FetchController] locale found in cache.");
            dispatch({
                type: 'setLocale',
                locale,
            });
            return;
        }
        // console.log("[FetchController] locale not found in cache.");

        // We need to request this locale.
        const url = typeof localeUrl === 'function'
            ? localeUrl(locale)
            : `${localeUrl}/${locale}.json`;
        // console.log("[FetchController] will request from %O", url);
        dispatch({ type: 'setRequestedLocale', locale, });

        // Issue the request.
        fetch(
            url, fetchOptions
        ).then((response) => {
            // console.log("[FetchController] message received %O", response);
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
            // console.log("[FetchController] got json %O", messages);
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
    }, [state.messages, fetchOptions, localeUrl, state.locale]);


    // Executed at mount time.
    useEffect(() => {
        // console.log("[FetchController] initial render");

        // Load initial locale.
        if (initialLocale === 'browser') {
            setLocale(navigator.language);
        } else {
            setLocale(initialLocale);
        }

        // Executed at unmount time.
        return () => {
            // console.log("[FetchController] unmounting...");

            // If a fetch request is in progress, then abort it.
            if (abortController.current) {
                abortController.current.abort();
                abortController.current = undefined;
                // console.log("[FetchController] a pending request was aborted");
            }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps


    // The value for react-intl context.
    const value: IntlShape | undefined = useMemo(() => {
        if (!state.locale) {
            // console.log("[FetchController] no locale, no intl");
            return undefined;
        }
        const messages = state.messages[state.locale];
        // console.log(
        //     "[FetchController] creating intl for %O, %O",
        //     state.locale, messages
        // );
        return createIntl({
            locale: state.locale,
            messages,
            ...rest,
        }, createIntlCache());

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.locale, state.messages]);
    // console.log("[FetchController] Intl value is now %O", value);

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
