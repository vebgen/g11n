import { createContext, useContext } from "react";


/**
 * The shape of the value in the context.
 */
export interface G11nContextValue {
    /**
     * The key of the current locale.
     */
    locale: string;

    /**
     * The method to use to change the current locale.
     */
    setLocale: (locale: string) => void;
}


/**
 * This is where we deposit the current locale.
 */
export const g11nContext = createContext<G11nContextValue>(null as any);


/**
 * Wrap your components in this provider to make the current locale available.
 */
export const { Provider: G11nProvider } = g11nContext;


/**
 * Use this hook to access the current locale.
 */
export const useG11n = () => {
    return useContext(g11nContext);
}
