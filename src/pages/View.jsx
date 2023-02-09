import React from "react"
import styles from "./View.module.css"
import { ViewMode, ViewContext } from "../context/ViewContext"
import Chat from "../components/Chat"
import CustomButton from "../components/custom-button"

function View({templateInfo}) {
  const { setViewMode } = React.useContext(ViewContext)

  const back = () => {
    setViewMode(ViewMode.BIO)
  }
  const next = () =>{
    setViewMode(ViewMode.MINT)
  }

  return (
    <div className={styles.container}>
      <div className={"sectionTitle"}>Chat With Your Character</div>
      <div className={styles.chatContainer}>
        <div className={styles.topLine} />
        <div className={styles.bottomLine} />
        <div className={styles.scrollContainer}>
          <Chat
            templateInfo = {templateInfo}
          />
        </div>
      </div>
      <div className={styles.buttonContainer}>
        <CustomButton
          theme="light"
          text="Back"
          size={14}
          className={styles.buttonLeft}
          onClick={back}
        />
        <CustomButton
                    theme="light"
                    text="Next"
                    size={14}
                    className={styles.buttonRight}
                    onClick={next}
                />
      </div>
    </div>
  )
}

export default View
