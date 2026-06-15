import CoreImage
import CoreVideo

final class ChromaKeyRenderer {
    private let cubeDimension = 64
    private let cubeData: Data

    private let context = CIContext(options: [
        .workingColorSpace: NSNull(),
        .outputColorSpace: NSNull()
    ])

    init() {
        cubeData = Self.makeCubeData(
            dimension: cubeDimension,
            threshold: 0.15,
            softness: 0.16,
            edgeAlphaGamma: 1.0,
            despillThreshold: 0.02,
            despillStrength: 0.72
        )
    }

    func makeChromaKeyedImage(from pixelBuffer: CVPixelBuffer) -> CGImage? {
        let inputImage = CIImage(cvPixelBuffer: pixelBuffer)
        let outputImage = applyColorCube(to: inputImage)

        return context.createCGImage(outputImage, from: outputImage.extent)
    }

    func makeChromaKeyedImage(from cgImage: CGImage) -> CGImage? {
        let inputImage = CIImage(cgImage: cgImage)
        let outputImage = applyColorCube(to: inputImage)

        return context.createCGImage(outputImage, from: outputImage.extent)
    }

    private func applyColorCube(to image: CIImage) -> CIImage {
        guard let filter = CIFilter(name: "CIColorCube") else {
            return image
        }

        filter.setValue(image, forKey: kCIInputImageKey)
        filter.setValue(cubeDimension, forKey: "inputCubeDimension")
        filter.setValue(cubeData, forKey: "inputCubeData")

        return filter.outputImage ?? image
    }

    private static func makeCubeData(
        dimension: Int,
        threshold: Float,
        softness: Float,
        edgeAlphaGamma: Float,
        despillThreshold: Float,
        despillStrength: Float
    ) -> Data {
        let size = dimension * dimension * dimension * 4
        var cube = [Float](repeating: 0, count: size)
        var offset = 0
        let maxIndex = Float(dimension - 1)

        for blueIndex in 0..<dimension {
            let blue = Float(blueIndex) / maxIndex

            for greenIndex in 0..<dimension {
                let green = Float(greenIndex) / maxIndex

                for redIndex in 0..<dimension {
                    let red = Float(redIndex) / maxIndex
                    let greenDominance = green - max(red, blue)
                    let keyAmount = smoothStep(edge0: threshold, edge1: threshold + softness, value: greenDominance)
                    let alpha = pow(1.0 - keyAmount, edgeAlphaGamma)
                    let despillAmount = smoothStep(
                        edge0: despillThreshold,
                        edge1: threshold + softness,
                        value: greenDominance
                    ) * despillStrength
                    let cleanGreen = min(green, max(red, blue) * 0.9 + min(red, blue) * 0.1)
                    let outputGreen = mix(green, cleanGreen, amount: despillAmount)

                    cube[offset] = red
                    cube[offset + 1] = outputGreen
                    cube[offset + 2] = blue
                    cube[offset + 3] = alpha
                    offset += 4
                }
            }
        }

        return cube.withUnsafeBufferPointer { pointer in
            Data(buffer: pointer)
        }
    }

    private static func smoothStep(edge0: Float, edge1: Float, value: Float) -> Float {
        guard edge0 != edge1 else {
            return value < edge0 ? 0 : 1
        }

        let normalized = min(max((value - edge0) / (edge1 - edge0), 0), 1)
        return normalized * normalized * (3 - 2 * normalized)
    }

    private static func mix(_ start: Float, _ end: Float, amount: Float) -> Float {
        start + (end - start) * min(max(amount, 0), 1)
    }
}
