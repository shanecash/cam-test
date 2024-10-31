import { useRef, useEffect } from "react";
import { useActor, useMachine } from "@xstate/react";
import Hls from "hls.js";
import { assign, enqueueActions, fromCallback, sendTo, setup } from "xstate";

const isHlsSupported = () => Hls.isSupported;

const listener = fromCallback(({ sendBack, receive, input }) => {
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

  return () => {
    hls.destroy();
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
      invoke: {
        id: "listener",
        src: "listener",
        input: ({ context }) => ({
          videoRef: context.videoRef,
          videoSrc: context.videoSrc,
        }),
      },
    },
    notSupported: {},
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
        {state.matches("starting") && <>Starting</>}
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
