/// <reference types="@citizenfx/server" />
/// <reference types="image-js" />

const imagejs = require('image-js');
const fs = require('fs');

const CLOTHING_CONFIG = {
    CLOTHING: {
        "2": { fov: 30, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.65, name: "hair" },         // Cheveux
        "1": { fov: 30, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.65, name: "masks" },         // Masques
        "3": { fov: 55, rotation: { x: 0, y: 0, z: 155 }, zPos: 0.3, name: "torsos" },        // Bras
        "4": { fov: 60, rotation: { x: 0, y: 0, z: 155 }, zPos: -0.46, name: "pants" },        // Jambes
        "5": { fov: 40, rotation: { x: 0, y: 0, z: -25 }, zPos: 0.3, name: "bags" },          // Sacs
        "6": { fov: 40, rotation: { x: 0, y: 0, z: 120 }, zPos: -0.85, name: "shoes" },       // Chaussures
        "7": { fov: 45, rotation: { x: 0, y: 0, z: 155 }, zPos: 0.3, name: "necks" },   // Accessoires
        "8": { fov: 45, rotation: { x: 0, y: 0, z: 155 }, zPos: 0.3, name: "undershirts" },   // T-shirts
        "9": { fov: 45, rotation: { x: 0, y: 0, z: 155 }, zPos: 0.3, name: "vests" },    // Gilets pare-balles
        "10": { fov: 45, rotation: { x: 0, y: 0, z: 155 }, zPos: 0.3, name: "decals" },    // Autocollants
        "11": { fov: 55, rotation: { x: 0, y: 0, z: 155 }, zPos: 0.26, name: "jackets" },         // Hauts
    },
    PROPS: {
        "0": { fov: 30, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.75, name: "hats" },         // Chapeaux
        "1": { fov: 20, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.7, name: "glasses" },       // Lunettes
        "2": { fov: 20, rotation: { x: 0, y: 0, z: 237.5 }, zPos: 0.675, name: "earrings" },      // Oreilles
        "6": { fov: 20, rotation: { x: 0, y: 0, z: 59 }, zPos: 0.03, name: "watches" },       // Montres
        "7": { fov: 20, rotation: { x: 0, y: 0, z: 250 }, zPos: 0.03, name: "bracelets" }     // Bracelets
    },
    TKT: {
        "1": { fov: 30, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.7, name: "facialHair" },     // Barbe
        "2": { fov: 30, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.7, name: "eyebrows" },  // Sourcils
        "4": { fov: 30, rotation: { x: 0, y: 0, z: 120 }, zPos: 0.7, name: "makeup" },  // Maquillage
    }
};

const resName = GetCurrentResourceName();
const mainSavePath = path.join(GetResourcePath(resName), 'images');

if (!fs.existsSync(mainSavePath)) {
    fs.mkdirSync(mainSavePath, { recursive: true });
}

async function processImage(croppedImage, fileName) {
    try {
        const image = new imagejs.Image({
            width: croppedImage.width,
            height: croppedImage.height,
            data: croppedImage.data
        });

        // Traitement du fond vert
        for (let x = 0; x < image.width; x++) {
            for (let y = 0; y < image.height; y++) {
                const pixelArr = image.getPixelXY(x, y);
                const r = pixelArr[0];
                const g = pixelArr[1];
                const b = pixelArr[2];

                if (g > r + b) {
                    image.setPixelXY(x, y, [255, 255, 255, 0]);
                }
            }
        }

        const resizedImage = image.resize({
            width: 512,
            height: 512,
            preserveAspectRatio: true,
            interpolation: 'nearestNeighbor'
        });

        await resizedImage.save(fileName);
        
    } catch (error) {
        console.error('Erreur processImage:', error);
        throw error;
    }
}

async function takeScreenshotForComponent(source, pedType, type, component, drawable, texture) {
    try {
        type = type.toUpperCase();
        
        if (!CLOTHING_CONFIG[type] || !CLOTHING_CONFIG[type][component]) {
            console.error('Configuration invalide:', { type, component });
            return;
        }

        const config = CLOTHING_CONFIG[type][component];
        const savePath = path.join(mainSavePath, pedType, config.name, drawable.toString());
        
        fs.mkdirSync(savePath, { recursive: true });
        const fullPath = path.join(savePath, `${texture}.png`);

        exports['screenshot-basic'].requestClientScreenshot(source, {
            fileName: fullPath,
            encoding: 'png',
            quality: 1.0
        }, async (err, fileName) => {
            if (err) {
                console.error('Erreur screenshot:', err);
                return;
            }

            try {
                let image = await imagejs.Image.load(fileName);
                const croppedImage = image.crop({ x: image.width / 4.5, width: image.height });
                await processImage(croppedImage, fileName);
                
                emitNet('screenshot:progress', source, {
                    type: config.name,
                    value: drawable,
                    texture: texture
                });
            } catch (imageError) {
                console.error('Erreur traitement image:', imageError);
            }
        });
    } catch (error) {
        console.error('Erreur takeScreenshotForComponent:', error);
    }
}

onNet('takeScreenshot', async (modelHash, type, drawable, texture) => {
    try {
        const [pedPrefix, compId, index] = modelHash.split('_');
        const pedType = pedPrefix === 'male' ? 'mp_m_freemode_01' : 'mp_f_freemode_01';
        
        if (!['CLOTHING', 'PROPS', 'TKT'].includes(type.toUpperCase())) {
            console.error('Type invalide:', type);
            return;
        }
        
        await takeScreenshotForComponent(
            source, 
            pedType,
            type,
            compId,
            parseInt(index) || 0,
            texture || 0
        );
    } catch (error) {
        console.error('Erreur takeScreenshot:', error);
    }
});