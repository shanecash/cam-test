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
    if (data.fatal) {
      sendBack({ type: "FATAL_ERROR" });
      return;
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
      on: {
        FATAL_ERROR: { target: "#retrying" },
      },
      states: {
        connecting: {
          on: {
            MANIFEST_LOADED: {
              target: "connected",
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
    retrying: {
      id: "retrying",
      after: {
        5000: {
          target: "started",
        },
      },
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
        {state.matches("retrying") && <div className="state">Retrying</div>}
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
