/**
 * 最後の砦。
 *
 * PWAは端末にデータもコードも残るため、想定外のデータで描画が落ちると
 * 画面が真っ白のまま何もできなくなる。ユーザーが自力で復旧できるように、
 * 必ず「やり直す」導線を出す。
 */
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { clearSave } from "../state/storage";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 送信先を持たない(サーバーなし)ので、開発者が見られる形で残すだけ
    console.error("描画に失敗しました", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app setup">
        <div className="setup-inner">
          <h1>うまく ひらけませんでした</h1>
          <p className="setup-lead">
            保存されたデータが 読めないみたいです。
            <br />
            下のボタンで やり直すと なおります。
            <br />
            <small>(あつめた素材は消えてしまいます。ごめんね)</small>
          </p>
          <button
            className="btn primary wide"
            onClick={() => {
              clearSave();
              location.reload();
            }}
          >
            データを初期化して やり直す
          </button>
          <button
            className="btn wide"
            style={{ marginTop: 10 }}
            onClick={() => location.reload()}
          >
            もういちど ひらく
          </button>
          <details className="debug-card" style={{ marginTop: 18 }}>
            <summary>エラーの内容</summary>
            <p style={{ fontSize: 11, wordBreak: "break-all" }}>
              {this.state.error.message}
            </p>
          </details>
        </div>
      </div>
    );
  }
}
