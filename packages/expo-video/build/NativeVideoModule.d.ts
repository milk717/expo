import type { VideoPlayer } from './VideoPlayer.types';
type ExpoVideoModule = {
    VideoPlayer: typeof VideoPlayer;
    isPictureInPictureSupported(): boolean;
    cleanVideoCache(): void;
    cleanAllVideoCache(): void;
};
declare const _default: ExpoVideoModule;
export default _default;
//# sourceMappingURL=NativeVideoModule.d.ts.map