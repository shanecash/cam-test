import { useRef, useEffect } from "react";
import { useActor } from "@xstate/react";
import Hls from "hls.js";
import { fromCallback, setup } from "xstate";

const isHlsSupported = () => Hls.isSupported;

const listener = fromCallback(({ sendBack, input }) => {
  let hls = new Hls({
    //xhrSetup: (xhr) => {
    //xhr.setRequestHeader(
    //"Authorization",
    //`Bearer ${import.meta.env.VITE_ACCESS_TOKEN}`
    //);
    //},
  });

  hls.loadSource(input.videoSrc);

  hls.attachMedia(input.videoRef.current);

  Object.values(Hls.Events).forEach((hlsEvent) => {
    hls.on(hlsEvent, function (event, data) {
      console.log(event);
      console.log(`HLS Event: ${hlsEvent}`, data);
    });
  });

  hls.on(Hls.Events.MANIFEST_LOADED, function () {
    sendBack({
      type: "MANIFEST_LOADED",
    });
  });

  hls.on(Hls.Events.FRAG_BUFFERED, () => {
    sendBack({ type: "FRAG_BUFFERED" });
  });

  hls.on(Hls.Events.ERROR, (event, data) => {
    switch (data.details) {
      case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
        console.error(input.videoSrc, "manifest load error");
        sendBack({ type: "MANIFEST_LOAD_ERROR" });
        break;
      case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
        console.error(input.videoSrc, "manifest load timeout");
        sendBack({ type: "MANIFEST_LOAD_TIMEOUT" });
        break;
      case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
        console.error(input.videoSrc, "manifest parsing error");
        sendBack({ type: "MANIFEST_PARSING_ERROR" });
        break;
      default:
        break;
    }
  });

  const handlePlaying = () => {
    sendBack({ type: "VIDEO_PLAYING" });
  };

  const handleWaiting = () => {
    sendBack({ type: "VIDEO_BUFFERING" });
  };

  input.videoRef.current.addEventListener("playing", handlePlaying);
  input.videoRef.current.addEventListener("waiting", handleWaiting);

  return () => {
    hls.destroy();

    input.videoRef.current.removeEventListener("playing", handlePlaying);
    input.videoRef.current.removeEventListener("waiting", handleWaiting);
  };
});

const hlsMachine = setup({
  actors: {
    listener,
  },
  guards: {
    isHlsSupported,
  },
}).createMachine({
  id: "hls",
  initial: "starting",
  context: ({ input }) => ({
    videoRef: input.videoRef,
    videoSrc: input.videoSrc,
  }),
  on: {
    START: [
      {
        guard: isHlsSupported,
        target: ".started",
      },
      {
        target: ".notSupported",
      },
    ],
  },
  states: {
    starting: {},
    started: {
      initial: "connecting",
      invoke: {
        id: "listener",
        src: "listener",
        input: ({ context }) => ({
          videoRef: context.videoRef,
          videoSrc: context.videoSrc,
        }),
      },
      states: {
        connecting: {
          on: {
            MANIFEST_LOADED: {
              target: "connected",
            },
            MANIFEST_LOAD_ERROR: {
              target: "#retry",
            },
            MANIFEST_LOAD_TIMEOUT: {
              target: "#retry",
            },
            MANIFEST_PARSING_ERROR: {
              target: "#retry",
            },
          },
        },
        connected: {
          id: "connected",
          initial: "initialBuffering",
          states: {
            initialBuffering: {
              on: {
                FRAG_BUFFERED: {
                  target: "streaming",
                },
              },
            },
            streaming: {
              on: {
                BUFFERING: {
                  target: "buffering",
                },
                VIDEO_BUFFERING: {
                  target: "buffering",
                },
              },
            },
            buffering: {
              on: {
                VIDEO_PLAYING: { target: "streaming" },
              },
            },
          },
        },
      },
    },
    retry: {
      id: "retry",
    },
    notSupported: {
      type: "final",
    },
  },
});

function useHlsHook(videoRef, videoSrc) {
  const isFirstMount = useRef(true);

  const [state, send] = useActor(hlsMachine, {
    input: {
      videoRef,
      videoSrc,
    },
  });

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      send({ type: "START" });
    }
  }, [send, videoRef]);

  return {
    state,
  };
}

function App() {
  const videoRef = useRef(null);

  const { state } = useHlsHook(
    videoRef,
    "https://stream3.camara.gov.br/tv1/manifest.m3u8"
  );

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
      <div
        className="container"
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        {state.matches("notSupported") && (
          <div className="state">HLS player is not supported</div>
        )}
        {state.matches("started.connecting") && (
          <div className="state">Connecting</div>
        )}
        {state.matches("started.connected.initialBuffering") && (
          <div className="state">Connected - Initial Buffering</div>
        )}
        {state.matches("started.connected.streaming") && (
          <div className="state">Connected - Streaming</div>
        )}
        {state.matches("started.connected.buffering") && (
          <div className="state">Connected - Buffering</div>
        )}
        {state.matches("started.retrying") && (
          <div className="state">Retrying</div>
        )}
        <video
          id="video"
          ref={videoRef}
          autoPlay
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        ></video>
      </div>
    </div>
  );
}

export default App;
