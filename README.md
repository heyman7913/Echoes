# Echoes

## Running the project

cd Echoes
npx expo start -c

## Installs

npm install
npx expo install react-native-paper
npx expo install expo-splash-screen
npm install @supabase/supabase-js
npm install weaviate-ts-client
npm install axios
npx expo install expo-av expo-speech expo-linear-gradient
npm install react-native-gesture-handler


## for supabase
~ powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
