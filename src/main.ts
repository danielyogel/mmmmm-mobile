/**
 * MMMMM is a mobile app for Secure Scuttlebutt networks
 *
 * Copyright (C) 2017 Andre 'Staltz' Medeiros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import xs, {Stream} from 'xstream';
import {ReactElement} from 'react';
import isolate from '@cycle/isolate';
import {ScreenSource, h} from '@cycle/native-screen';
import {View, Text, StyleSheet} from 'react-native';
import {StateSource, Reducer} from 'cycle-onionify';
import {SSBSource} from './drivers/ssb';
import {ScreenVNode, Command, PushCommand} from 'cycle-native-navigation';
import {central} from './scenes/central/index';
import {profile} from './scenes/profile/index';
import {State as ProfileState} from './scenes/profile/model';
import {State as CentralState} from './scenes/central/model';
import {Content} from './ssb/types';

export type Sources = {
  screen: ScreenSource;
  onion: StateSource<any>;
  ssb: SSBSource;
};

export type Sinks = {
  screen: Stream<ScreenVNode>;
  navCommand: Stream<Command>;
  onion: Stream<Reducer<any>>;
  ssb: Stream<Content>;
};

export type ScreenID = 'mmmmm.Central' | 'mmmmm.Profile';

export type State = {
  profile: ProfileState;
  central: CentralState;
};

function isPushCommand(c: Command): c is PushCommand {
  return c.type === 'push';
}

function model(navCommand$: Stream<Command>): Stream<Reducer<State>> {
  const setProfileDisplayFeedId$ = navCommand$
    .filter(isPushCommand)
    .filter(command => (command.screen as ScreenID) === 'mmmmm.Profile')
    .map(
      command =>
        function setProfileDisplayFeedId(prevState: State): State {
          if (command.passProps && command.passProps.feedId) {
            return {
              ...prevState,
              profile: {
                ...prevState.profile,
                displayFeedId: command.passProps.feedId
              }
            };
          } else {
            return {
              ...prevState,
              profile: {
                ...prevState.profile,
                displayFeedId: prevState.profile.selfFeedId
              }
            };
          }
        }
    );

  return setProfileDisplayFeedId$;
}

export const styles = StyleSheet.create({
  container: {
    flex: 1
  },

  disclaimer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    color: 'black',
    fontSize: 15,
    transform: [{rotateZ: '-90deg'}, {translateY: -96}, {translateX: 140}]
  }
});

function addAlphaDisclaimer(screen$: Stream<ScreenVNode>): Stream<ScreenVNode> {
  return screen$.map(screen => ({
    screen: screen.screen,
    vdom: h(View, {style: styles.container}, [
      screen.vdom,
      h(Text, {style: styles.disclaimer}, 'Alpha version, not ready for use')
    ])
  }));
}

export function main(sources: Sources): Sinks {
  const profileSinks: Sinks = isolate(profile, 'profile')(sources);
  const centralSinks: Sinks = isolate(central, 'central')(sources);

  const screen$ = xs.merge(profileSinks.screen, centralSinks.screen);
  const navCommand$ = xs.merge(
    profileSinks.navCommand,
    centralSinks.navCommand
  );
  const mainReducer$ = model(navCommand$);
  const reducer$ = xs.merge(
    mainReducer$,
    profileSinks.onion,
    centralSinks.onion
  );
  const ssb$ = xs.merge(profileSinks.ssb, centralSinks.ssb);

  return {
    screen: screen$.compose(addAlphaDisclaimer),
    navCommand: navCommand$,
    onion: reducer$,
    ssb: ssb$
  };
}
