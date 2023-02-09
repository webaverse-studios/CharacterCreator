import React from "react"


export const StorageContext = React.createContext();

export const StorageProvider = (props) => {
    const saveStorage = () =>{

    }

    const [avatar, _setAvatar] = useState(null)
    const [bio, _setBio] = useState(null)
    const [manifest, _setManifest] = useState(null)
    const [personality, _setPersonality] = useState(null)
    const [initialTraits, _setInitialTraits] = useState(null)//might not be needed

    return (
        <StorageContext.Provider value={{
            avatar,
            bio,
            manifest,
            personality,
            initialTraits
        }}>
            {props.children}
        </StorageContext.Provider>
    )
}