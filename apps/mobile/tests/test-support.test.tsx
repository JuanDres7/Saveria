import { render, screen } from '@testing-library/react-native';
import { House } from 'lucide-react-native';
import { Text, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Path, Svg } from 'react-native-svg';
import {
  renderInBothModes,
  setColorScheme,
  setSafeAreaInsets,
  withFontScale,
} from './support/color-scheme';

function Probe() {
  const mode = useColorScheme();
  const insets = useSafeAreaInsets();
  return (
    <>
      <Text>{`modo:${mode ?? 'ninguno'} top:${insets.top} bottom:${insets.bottom}`}</Text>
      <Svg>
        <Path d="M0 0" />
      </Svg>
      <House testID="icono" />
    </>
  );
}

describe('preparación', () => {
  renderInBothModes('el modo llega a useColorScheme', async (mode) => {
    await render(<Probe />);
    expect(screen.getByText(new RegExp(`modo:${mode}`))).toBeTruthy();
    expect(screen.getByTestId('icono', { includeHiddenElements: true })).toBeTruthy();
  });
  it('cambia de modo con la pantalla dibujada', async () => {
    await render(<Probe />);
    await setColorScheme('dark');
    expect(screen.getByText(/modo:dark/)).toBeTruthy();
    await setColorScheme('light');
  });
  it('márgenes del sistema', async () => {
    setSafeAreaInsets({ bottom: 34 });
    await render(<Probe />);
    expect(screen.getByText(/bottom:34/)).toBeTruthy();
    setSafeAreaInsets({ bottom: 16 });
  });
  it('letra al 150 %', async () => {
    await withFontScale(1.5, async () => {
      const { PixelRatio } = require('react-native');
      expect(PixelRatio.getFontScale()).toBe(1.5);
    });
  });
});
