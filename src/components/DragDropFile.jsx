import React from "react"
import styles from "./DragDropFile.module.css"

function DragDropFile({setLoadedFiles}) {
  // drag state
  const [dragActive, setDragActive] = React.useState(false);

  // handle drag events
  const handleDrag = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  const handleDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    console.log(e)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      // at least one file has been dropped so do something
      setLoadedFiles(e.dataTransfer.files)
      console.log(e.dataTransfer.files)
      //handleFiles(e.dataTransfer.files);
    }
  }
  return (
    <form id="form-file-upload" className={styles["form-file-upload"]} onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
      <input type="file" id="input-file-upload" className={styles["input-file-upload"]} multiple={true} />
      { dragActive && <div id="drag-file-element" className={styles["drag-file-element"]} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div> }
    </form>
  )
}

export default DragDropFile