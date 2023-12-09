import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import { FormattedMessage } from 'react-intl';
import { useG11n } from "..";
import { FetchController, FetchControllerProps } from "./controller";


// The properties passed to each story.
type StoryProps = FetchControllerProps;


// Common configuration for all stories.
const storybookConfig: Meta<StoryProps> = {
    title: 'fetch/controller',
    tags: ['controller'],
    component: FetchController,
    args: {
        initialLocale: "en",
        localeUrl: 'translations',
        messages: {
            en: {
                hello: 'Hello',
            },
        },
    },
    parameters: {
        mockData: [
            {
                url: '/translations/fr.json',
                method: 'GET',
                status: 200,
                response: {
                    hello: 'Bonjour'
                },
            },
            {
                url: '/translations/ro.json',
                method: 'GET',
                status: 200,
                response: {
                    hello: 'Salut'
                },
            },
        ],
    },
};
export default storybookConfig;


// Picks up the props from the context.
const Viewer = () => {
    const { locale, setLocale } = useG11n();
    return (
        <div>
            <p>Current navigator locale: <code>{navigator.language}</code></p>
            <p>Current locale: <code>{locale}</code></p>
            <p><FormattedMessage id="hello" /></p>
            <button onClick={() => setLocale('fr')}>fr</button>
            <button onClick={() => setLocale('en')}>en</button>
            <button onClick={() => setLocale('ro')}>ro</button>
        </div>
    );
}


// Base for all stories in this file.
const Template: StoryFn<StoryProps> = (args) => (
    <FetchController {...args}>
        <Viewer />
    </FetchController>
);


/**
 * The default story.
 */
export const Default: StoryFn<StoryProps> = Template.bind({});
Default.args = {};
