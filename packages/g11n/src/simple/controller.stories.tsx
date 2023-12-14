import React from 'react';
import { StoryFn, Meta } from '@storybook/react';
import { FormattedMessage } from 'react-intl';

import { useG11n } from '..';
import { SimpleController, SimpleControllerProps } from "./controller";


// The properties passed to each story.
type StoryProps = SimpleControllerProps;


// Common configuration for all stories.
const storybookConfig: Meta<StoryProps> = {
    title: 'simple/controller',
    tags: ['controller'],
    component: SimpleController,
    args: {
        initialLocale: "en",
        messages: {
            en: {
                hello: 'Hello',
            },
            fr: {
                hello: 'Bonjour',
            },
            ro: {
                hello: 'Salut',
            },
        },
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
    <SimpleController {...args}>
        <Viewer />
    </SimpleController>
);


/**
 * The default story.
 */
export const Default: StoryFn<StoryProps> = Template.bind({});
Default.args = {};
